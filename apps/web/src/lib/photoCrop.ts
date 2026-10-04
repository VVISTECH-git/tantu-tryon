import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import { db, partLabels, type Garment, type PartRegion } from "@/db";
import type { PartSlot } from "@/lib/garments";
import { getObject, keys, putObject } from "@/lib/storage";
import { recordPhoto, uprightSize } from "@/lib/uploads";

/** A crop in percent of the upright photo. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SIDE = 64;

/**
 * Crop one of a product's photos from the website (4 Oct). The original is
 * cut at full resolution — JPEG stays JPEG at quality 100, PNG stays
 * lossless — and recorded as the part's new photo, which also clears the
 * cached sheet. The old file stays in storage until "Delete unused".
 * Parts marked on the photo are moved and trimmed to the new frame.
 */
export async function cropProductPhoto(garment: Garment, slot: PartSlot, rect: CropRect, by: string | null): Promise<Garment> {
  const part = garment.parts.find((p) => p.slot === slot && p.key);
  if (!part?.key) throw new Error("That photo is not there.");
  const original = await getObject(part.key);
  const { width: W, height: H } = await uprightSize(original);
  const left = Math.max(0, Math.round((rect.x / 100) * W));
  const top = Math.max(0, Math.round((rect.y / 100) * H));
  const width = Math.min(W - left, Math.round((rect.w / 100) * W));
  const height = Math.min(H - top, Math.round((rect.h / 100) * H));
  if (width < MIN_SIDE || height < MIN_SIDE) throw new Error("That crop is too small.");

  const png = (await sharp(original).metadata()).format === "png";
  const cut = sharp(original).autoOrient().extract({ left, top, width, height });
  const bytes = png ? await cut.png().toBuffer() : await cut.jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
  const mime = png ? "image/png" : "image/jpeg";
  const key = keys.part(garment.id, slot, png ? "png" : "jpg");
  await putObject(key, bytes, mime);
  const { garment: updated } = await recordPhoto(garment, slot, bytes, mime, key, part.takenBy ?? by);

  // The exact crop that was cut, in percent, for moving the marks.
  await moveMarks(garment.id, slot, { x: (left / W) * 100, y: (top / H) * 100, w: (width / W) * 100, h: (height / H) * 100 }, bytes, width, height);
  return updated;
}

async function moveMarks(garmentId: string, slot: string, c: CropRect, bytes: Buffer, width: number, height: number): Promise<void> {
  const [label] = await db
    .select()
    .from(partLabels)
    .where(and(eq(partLabels.garmentId, garmentId), eq(partLabels.slot, slot)))
    .limit(1);
  if (!label) return;
  const regions: PartRegion[] = [];
  for (const r of label.regions) {
    const moved = r.points.map(([x, y]) => [((x - c.x) / c.w) * 100, ((y - c.y) / c.h) * 100] as [number, number]);
    const kept = clipToFrame(moved);
    if (kept.length >= 3 && area(kept) > 0.05) {
      regions.push({ label: r.label, points: kept.map(([x, y]) => [round(x), round(y)] as [number, number]) });
    }
  }
  const preview = await sharp(bytes)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  await putObject(label.previewKey, preview, "image/jpeg");
  await db
    .update(partLabels)
    .set({ regions, width, height, status: "pending", reviewedBy: null, reviewedAt: null, photoEditedAt: new Date(), updatedAt: new Date() })
    .where(eq(partLabels.id, label.id));
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Polygon area in square percent, to drop slivers left after a crop. */
function area(points: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Sutherland–Hodgman: the part of a polygon inside the 0–100 frame. */
function clipToFrame(points: [number, number][]): [number, number][] {
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= 0, (a, b) => at(a, b, 0, 0)],
    [(p) => p[0] <= 100, (a, b) => at(a, b, 0, 100)],
    [(p) => p[1] >= 0, (a, b) => at(a, b, 1, 0)],
    [(p) => p[1] <= 100, (a, b) => at(a, b, 1, 100)],
  ];
  let out = points;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]!;
      const prev = input[(i + input.length - 1) % input.length]!;
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
    }
    if (out.length === 0) break;
  }
  return out;
}

/** Where segment a→b crosses the line axis = value. */
function at(a: [number, number], b: [number, number], axis: 0 | 1, value: number): [number, number] {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
