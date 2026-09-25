import sharp from "sharp";

/**
 * Where the saree is in a photo of it hanging, as fractions of the photo.
 *
 * A hung saree is busy — print, borders, zari — and what surrounds it is
 * usually quieter: a wall, a cloth, a cupboard. So the photo is shrunk,
 * turned grey, and each column and row is scored by how much the picture
 * changes along it. The saree is the widest run of busy columns, and within
 * those, the tallest run of busy rows. It is only a starting box for the
 * crop screen; the person moves it if it is off. Null when the photo gives
 * no clear answer (everything busy, or nothing).
 */

export interface FabricBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EDGE = 240;

function smooth(values: number[], radius: number): number[] {
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
      sum += values[j]!;
      n++;
    }
    return sum / n;
  });
}

/** The longest run of values at or above the threshold, allowing short dips inside it. */
function longestRun(values: number[], threshold: number, allowGap: number): [number, number] | null {
  let best: [number, number] | null = null;
  let start = -1;
  let lastHigh = -1;
  for (let i = 0; i <= values.length; i++) {
    const high = i < values.length && values[i]! >= threshold;
    if (high) {
      if (start < 0) start = i;
      lastHigh = i;
    } else if (start >= 0 && (i === values.length || i - lastHigh > allowGap)) {
      if (!best || lastHigh - start > best[1] - best[0]) best = [start, lastHigh];
      start = -1;
    }
  }
  return best;
}

function busyRun(energy: number[], allowGap: number): [number, number] | null {
  const smoothed = smooth(energy, 2);
  const sorted = [...smoothed].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.1)]!;
  const high = sorted[Math.floor(sorted.length * 0.9)]!;
  if (high < 1) return null;
  // Busy everywhere (the saree fills the photo): the core is the whole range.
  if ((high - low) / high < 0.35) return [0, energy.length - 1];
  return longestRun(smoothed, low + (high - low) * 0.35, allowGap);
}

/** Colour distance between the mean colours of two bands of columns (or rows). */
function stepAt(means: [number, number, number][], i: number, band: number): number {
  const avg = (from: number, to: number) => {
    const acc = [0, 0, 0];
    let n = 0;
    for (let j = Math.max(0, from); j <= Math.min(means.length - 1, to); j++) {
      acc[0] += means[j]![0];
      acc[1] += means[j]![1];
      acc[2] += means[j]![2];
      n++;
    }
    return acc.map((v) => v / Math.max(1, n));
  };
  const a = avg(i - band, i - 1);
  const b = avg(i, i + band - 1);
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}

/**
 * From the edge of the busy core outward, the strongest colour step: the
 * outer edge of a plain border against the wall. The step between print and
 * border sits right at the core, so a short gap next to it is skipped. No
 * clear step means the saree runs to the photo's edge.
 */
function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

/**
 * Where the fabric ends beyond the busy core, and whether that was a clear
 * edge. The first strong colour change outward is the border's outer edge
 * against the wall (not the strongest anywhere: a cabinet further out must
 * not win). With no strong change, the colour decides: a plain, grey-ish
 * stretch is wall, so the fabric ends at the core; a coloured one is a
 * border running on to the photo's edge.
 */
function outerEdge(
  means: [number, number, number][],
  coreEdge: number,
  outward: -1 | 1,
  skip: number,
  band: number,
): { at: number; clear: boolean } {
  const n = means.length;
  const reach = Math.round(n * 0.3);
  const steps: { i: number; step: number }[] = [];
  for (let k = skip; k <= reach; k++) {
    const i = coreEdge + outward * k;
    if (i < band || i > n - band - 1) break;
    steps.push({ i, step: stepAt(means, outward < 0 ? i : i + 1, band) });
  }
  const max = Math.max(0, ...steps.map((s) => s.step));
  if (max >= 28) return { at: steps.find((s) => s.step >= max * 0.6)!.i, clear: true };
  const outside = outward < 0 ? means.slice(0, Math.max(1, coreEdge - skip)) : means.slice(Math.min(n - 1, coreEdge + skip));
  const sat = outside.reduce((sum, c) => sum + saturation(c), 0) / Math.max(1, outside.length);
  if (sat > 0.22) return { at: outward < 0 ? 0 : n - 1, clear: false };
  return { at: coreEdge, clear: true };
}

export async function findFabric(bytes: Uint8Array): Promise<FabricBox | null> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .removeAlpha()
    .resize({ width: EDGE, height: EDGE, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rgb = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 3;
    return [data[i]!, data[i + 1]!, data[i + 2]!];
  };
  const grey = (x: number, y: number) => {
    const [r, g, b] = rgb(x, y);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  // 1. The busy core: the print, by how much the picture changes.
  const grad = new Float32Array(w * h);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      grad[y * w + x] = Math.abs(grey(x + 1, y) - grey(x, y)) + Math.abs(grey(x, y + 1) - grey(x, y));
    }
  }
  const cols = Array.from({ length: w }, (_, x) => {
    let sum = 0;
    for (let y = 0; y < h; y++) sum += grad[y * w + x]!;
    return sum / h;
  });
  const colRun = busyRun(cols, Math.round(w * 0.03));
  if (!colRun) return null;
  let [left, right] = colRun;
  if (right - left + 1 < w * 0.15) return null;
  const rows = Array.from({ length: h }, (_, y) => {
    let sum = 0;
    for (let x = left; x <= right; x++) sum += grad[y * w + x]!;
    return sum / (right - left + 1);
  });
  const rowRun = busyRun(rows, Math.round(h * 0.03));
  if (!rowRun) return null;
  let [top, bottom] = rowRun;

  // 2. Out to the plain borders: the strongest colour step beyond the core.
  const colMeans = Array.from({ length: w }, (_, x) => {
    const acc: [number, number, number] = [0, 0, 0];
    for (let y = top; y <= bottom; y++) {
      const c = rgb(x, y);
      acc[0] += c[0];
      acc[1] += c[1];
      acc[2] += c[2];
    }
    const n = bottom - top + 1;
    return [acc[0] / n, acc[1] / n, acc[2] / n] as [number, number, number];
  });
  const skipX = Math.max(3, Math.round(w * 0.03));
  const bandX = Math.max(2, Math.round(w * 0.012));
  const L = outerEdge(colMeans, left, -1, skipX, bandX);
  const Rt = outerEdge(colMeans, right, 1, skipX, bandX);
  left = Math.min(left, L.at);
  right = Math.max(right, Rt.at);

  const rowMeans = Array.from({ length: h }, (_, y) => {
    const acc: [number, number, number] = [0, 0, 0];
    for (let x = left; x <= right; x++) {
      const c = rgb(x, y);
      acc[0] += c[0];
      acc[1] += c[1];
      acc[2] += c[2];
    }
    const n = right - left + 1;
    return [acc[0] / n, acc[1] / n, acc[2] / n] as [number, number, number];
  });
  const skipY = Math.max(3, Math.round(h * 0.03));
  const bandY = Math.max(2, Math.round(h * 0.012));
  const T = outerEdge(rowMeans, top, -1, skipY, bandY);
  const B = outerEdge(rowMeans, bottom, 1, skipY, bandY);
  top = Math.min(top, T.at);
  bottom = Math.max(bottom, B.at);

  if (right - left + 1 < w * 0.25 || bottom - top + 1 < h * 0.25) return null;
  // Only a box it is sure of: both side edges found clearly. Otherwise the
  // crop screen starts on the whole photo, as it did before.
  if (!L.clear || !Rt.clear) return null;
  if ((right - left + 1) / w > 0.97 && (bottom - top + 1) / h > 0.97) return null;
  // A margin outward on every side: a little wall left in costs nothing (the
  // prompt says the shop is not the saree); a border shaved off is lost.
  const padX = 0.03;
  const padY = 0.02;
  const x = Math.max(0, left / w - padX);
  const y = Math.max(0, top / h - padY);
  return { x, y, w: Math.min(1, (right + 1) / w + padX) - x, h: Math.min(1, (bottom + 1) / h + padY) - y };
}
