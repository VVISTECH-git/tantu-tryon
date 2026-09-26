import { and, desc, eq } from "drizzle-orm";
import { db, garments, generations } from "@/db";
import { publicUrl, storageConfigured } from "@/lib/storage";

/**
 * What went into an image and what came out, for the platform admin.
 *
 * Every generation keeps the exact prompt it was sent. Since 26 Sep it also
 * keeps the sheet; older rows show the product's current sheet instead,
 * marked as such, since the sheet may have been rebuilt after them.
 */
export interface GenerationRecord {
  id: string;
  startedAt: string;
  productCode: string | null;
  title: string;
  promptId: string;
  promptVersion: string;
  model: string;
  status: string;
  error: string | null;
  ms: number | null;
  costPaise: number;
  imageUrl: string | null;
  sheetUrl: string | null;
  /** False when the sheet is the product's current one, not a record of what this run was sent. */
  sheetRecorded: boolean;
  promptText: string;
}

const url = (key: string | null) => (key && storageConfigured() && !key.startsWith("local:") ? publicUrl(key) : null);

export async function generationRecords(options: { productCode?: string; id?: string; limit?: number } = {}): Promise<GenerationRecord[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const filters = [
    options.productCode ? eq(garments.productCode, options.productCode) : undefined,
    options.id ? eq(generations.id, options.id) : undefined,
  ].filter((f) => f !== undefined);
  const rows = await db
    .select({
      id: generations.id,
      startedAt: generations.startedAt,
      productCode: garments.productCode,
      title: garments.title,
      promptId: generations.promptId,
      promptVersion: generations.promptVersion,
      model: generations.model,
      status: generations.status,
      error: generations.error,
      ms: generations.ms,
      costPaise: generations.costPaise,
      imageKey: generations.imageKey,
      runSheetKey: generations.sheetKey,
      garmentSheetKey: garments.sheetKey,
      promptText: generations.promptText,
    })
    .from(generations)
    .innerJoin(garments, eq(garments.id, generations.garmentId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(generations.startedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    productCode: r.productCode,
    title: r.title,
    promptId: r.promptId,
    promptVersion: r.promptVersion,
    model: r.model,
    status: r.status,
    error: r.error,
    ms: r.ms,
    costPaise: r.costPaise,
    imageUrl: url(r.imageKey),
    sheetUrl: url(r.runSheetKey ?? r.garmentSheetKey),
    sheetRecorded: Boolean(r.runSheetKey),
    promptText: r.promptText,
  }));
}
