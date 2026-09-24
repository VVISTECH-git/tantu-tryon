import sharp from "sharp";
import type { PartQuality } from "@/db";
import type { Orientation } from "@/content/shots";

/**
 * The free check every uploaded photograph gets, within a second, before
 * anything is spent on it.
 *
 * Four things a phone gets wrong on a shop floor: shake, light, a photo too
 * small to fill a sheet cell, and the phone held the wrong way for the shot.
 * Everything is measured from the pixels with sharp; no model is called.
 * Thresholds start lenient — block only what will certainly print badly —
 * and are tuned on real rod uploads.
 */

interface Thresholds {
  sharpness: { block: number; warn: number };
  brightness: { blockBelow: number; warnBelow: number; warnAbove: number };
  /** Fraction of pixels blown to white: zari under flash. */
  bright: { warn: number };
  longSide: { block: number; warn: number };
}

const T: Thresholds = {
  sharpness: { block: 6, warn: 12 },
  brightness: { blockBelow: 22, warnBelow: 55, warnAbove: 222 },
  bright: { warn: 0.06 },
  longSide: { block: 1000, warn: 1500 },
};

/** Greyscale, at most this wide, for the measurements: the same scale every time so thresholds mean something. */
const MEASURE_EDGE = 512;

export interface QualityInput {
  bytes: Buffer;
  width: number;
  height: number;
  expected: Orientation | null;
}

export async function checkQuality(input: QualityInput): Promise<PartQuality> {
  const { data, info } = await sharp(input.bytes)
    .greyscale()
    .resize({ width: MEASURE_EDGE, height: MEASURE_EDGE, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const n = w * h;

  let sum = 0;
  let dark = 0;
  let bright = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i]!;
    sum += v;
    if (v < 12) dark++;
    if (v > 245) bright++;
  }
  const brightness = sum / n;

  // Variance of the Laplacian: how much each pixel differs from its
  // neighbours. A shaken or soft photograph has small differences everywhere.
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const mean = lapSum / count;
  const sharpness = Math.sqrt(Math.max(0, lapSq / count - mean * mean));

  const reasons: PartQuality["reasons"] = [];
  const long = Math.max(input.width, input.height);

  if (sharpness < T.sharpness.block) {
    reasons.push({ code: "blur", level: "block", message: "Blurred. Hold the phone still and tap once." });
  } else if (sharpness < T.sharpness.warn) {
    reasons.push({ code: "soft", level: "warn", message: "A little soft. Usable, but a steadier shot prints sharper." });
  }

  if (brightness < T.brightness.blockBelow) {
    reasons.push({ code: "dark", level: "block", message: "Too dark to read. Turn on the shop lights or move closer to them." });
  } else if (brightness < T.brightness.warnBelow) {
    reasons.push({ code: "dim", level: "warn", message: "Dark. Usable, but a brighter shot reads the colours better." });
  } else if (brightness > T.brightness.warnAbove) {
    reasons.push({ code: "washed", level: "warn", message: "Very bright. Move away from direct light." });
  }
  if (bright / n > T.bright.warn) {
    reasons.push({ code: "glare", level: "warn", message: "Glare on the fabric. Turn the flash off; zari flares white under it." });
  }

  if (long < T.longSide.block) {
    reasons.push({ code: "tiny", level: "block", message: "Too small. Use the phone camera at full size, not a screenshot or a forwarded copy." });
  } else if (long < T.longSide.warn) {
    reasons.push({ code: "small", level: "warn", message: "Small photo. Fine details may soften." });
  }

  if (input.expected) {
    const landscape = input.width > input.height;
    if (input.expected === "upright" && landscape) {
      reasons.push({ code: "orientation", level: "warn", message: "Hold the phone upright for this shot." });
    } else if (input.expected === "sideways" && !landscape) {
      reasons.push({ code: "orientation", level: "warn", message: "Turn the phone sideways for this shot." });
    }
  }

  const status: PartQuality["status"] = reasons.some((r) => r.level === "block") ? "block" : reasons.length ? "warn" : "ok";
  return {
    status,
    reasons,
    metrics: {
      sharpness: round(sharpness),
      brightness: round(brightness),
      dark: round(dark / n),
      bright: round(bright / n),
      width: input.width,
      height: input.height,
    },
  };
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
