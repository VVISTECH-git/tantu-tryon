import { db, garments, generations } from "@/db";
import { listObjects, storageConfigured, storageMissing } from "@/lib/storage";

/**
 * How much of the storage bucket Tantu uses, for the platform admin's
 * Storage page (the same idea as slk-core's /storage).
 *
 * Keys are laid out by kind: garments/<id>/<slot>-<stamp>.<ext> for photos
 * taken, garments/<id>/sheet-<stamp>.<ext> for the sheets sent to the image
 * model, renders/<garmentId>/<generationId>.<ext> for finished images.
 * Anything else in the bucket is not Tantu's. The bucket is listed in full
 * on every visit: fine for thousands of files, would want caching later.
 */
export interface StorageUsage {
  configured: boolean;
  missing: string[];
  bucket: string;
  totalBytes: number;
  totalCount: number;
  byKind: { kind: "photos" | "sheets" | "renders" | "other"; label: string; bytes: number; count: number }[];
  byProduct: { garmentId: string; productCode: string | null; title: string | null; bytes: number; count: number }[];
  /** Tantu files no garment or generation points at any more: safe to delete. */
  orphanCount: number;
  orphanBytes: number;
}

const LABEL = { photos: "Photos taken", sheets: "Input sheets", renders: "Generated images", other: "Not Tantu's" } as const;

function kindOf(key: string): keyof typeof LABEL {
  if (key.startsWith("renders/")) return "renders";
  if (key.startsWith("garments/")) return /\/sheet-/.test(key) ? "sheets" : "photos";
  return "other";
}

export async function loadStorageUsage(): Promise<StorageUsage> {
  const bucket = process.env.R2_BUCKET ?? "";
  if (!storageConfigured()) {
    return { configured: false, missing: storageMissing(), bucket, totalBytes: 0, totalCount: 0, byKind: [], byProduct: [], orphanCount: 0, orphanBytes: 0 };
  }

  const [objects, garmentRows, generationRows] = await Promise.all([
    listObjects(),
    db.select({ id: garments.id, productCode: garments.productCode, title: garments.title, parts: garments.parts, sheetKey: garments.sheetKey }).from(garments),
    db.select({ imageKey: generations.imageKey, sheetKey: generations.sheetKey }).from(generations),
  ]);

  const referenced = new Set<string>();
  for (const g of garmentRows) {
    if (g.sheetKey) referenced.add(g.sheetKey);
    for (const part of (g.parts ?? []) as { key?: string; previewKey?: string; thumbKey?: string }[]) {
      if (part.key) referenced.add(part.key);
      if (part.previewKey) referenced.add(part.previewKey);
      if (part.thumbKey) referenced.add(part.thumbKey);
    }
  }
  for (const r of generationRows) {
    if (r.imageKey) referenced.add(r.imageKey);
    if (r.sheetKey) referenced.add(r.sheetKey);
  }

  const kinds = new Map<keyof typeof LABEL, { bytes: number; count: number }>();
  const products = new Map<string, { bytes: number; count: number }>();
  let orphanBytes = 0;
  let orphanCount = 0;
  let totalBytes = 0;
  let totalCount = 0;

  for (const o of objects) {
    const kind = kindOf(o.key);
    const k = kinds.get(kind) ?? { bytes: 0, count: 0 };
    k.bytes += o.size;
    k.count += 1;
    kinds.set(kind, k);
    if (kind === "other") continue;

    totalBytes += o.size;
    totalCount += 1;
    const garmentId = o.key.split("/")[1] ?? "";
    const p = products.get(garmentId) ?? { bytes: 0, count: 0 };
    p.bytes += o.size;
    p.count += 1;
    products.set(garmentId, p);
    if (!referenced.has(o.key)) {
      orphanBytes += o.size;
      orphanCount += 1;
    }
  }

  const byGarment = new Map(garmentRows.map((g) => [g.id, g]));
  const byProduct = [...products.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 25)
    .map(([garmentId, s]) => ({
      garmentId,
      productCode: byGarment.get(garmentId)?.productCode ?? null,
      title: byGarment.get(garmentId)?.title ?? null,
      bytes: s.bytes,
      count: s.count,
    }));

  return {
    configured: true,
    missing: [],
    bucket,
    totalBytes,
    totalCount,
    byKind: (["photos", "sheets", "renders", "other"] as const)
      .filter((kind) => kinds.has(kind))
      .map((kind) => ({ kind, label: LABEL[kind], ...kinds.get(kind)! })),
    byProduct,
    orphanCount,
    orphanBytes,
  };
}
