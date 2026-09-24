import { eq } from "drizzle-orm";
import { db, garments, type Garment, type GarmentPartRow } from "@/db";
import { garmentWordsFrom, type DescribedGarment, type GarmentWords } from "@/content/garmentWords";
import type { Attachment } from "@/content/promptTemplates";
import { buildContactSheet } from "@/lib/contactSheet";
import { fetchBase64, fetchProduct, partsBySlot } from "@/lib/slk";
import { assetUrl, getObject, keys, putObject, readAsset, saveUpload, storageConfigured } from "@/lib/storage";

/**
 * A garment row: the saree, described well enough to photograph.
 *
 * Two ways in. A merchant uploads photographs — one flat photograph of the
 * whole saree (`saree`), or the labelled parts — or an SLK product code
 * fills everything. Either way the parts, the words and the labelled sheet
 * live on the row, so the flow can reload and the runs can point at it.
 */

/** Labelled parts, in reading order. `saree` is the whole thing laid flat. */
export const PART_ORDER = ["saree", "body", "pallu", "border", "blouse"] as const;
export type PartSlot = (typeof PART_ORDER)[number];

export const REQUIRED_SLOTS = ["body", "pallu", "border", "blouse"] as const;

export type GarmentResult = { ok: true; garment: Garment } | { ok: false; status: number; message: string };

/** Enough to photograph: the whole saree flat, or at least the body and the pallu. */
export function isReady(garment: Garment): boolean {
  const has = (slot: string) => garment.parts.some((p) => p.slot === slot);
  return has("saree") || (has("body") && has("pallu"));
}

export async function createGarmentFromSlk(accountId: string, code: string): Promise<GarmentResult> {
  const lookup = await fetchProduct(code);
  if (!lookup.ok) return lookup;
  const { product } = lookup;

  const parts: GarmentPartRow[] = [];
  for (const [slot, image] of partsBySlot(product)) {
    parts.push({ slot, key: null, url: image.url, width: image.width, height: image.height, rotate: 0 });
  }
  const blouseStyle = (product.design?.blouseStyle ?? "").toLowerCase();
  const [garment] = await db
    .insert(garments)
    .values({
      accountId,
      source: "slk",
      productCode: product.productCode,
      title: product.title,
      description: product.description,
      design: product.design,
      words: {},
      answers: { blouseSameAsBody: blouseStyle.includes("self") },
      parts,
    })
    .returning();
  if (!isReady(garment!)) {
    return { ok: false, status: 422, message: `${code} needs at least a body and a pallu photograph in SLK before it can be photographed.` };
  }
  return { ok: true, garment: garment! };
}

/** An empty garment for uploads to land in. */
export async function createUploadGarment(accountId: string): Promise<Garment> {
  const [garment] = await db
    .insert(garments)
    .values({ accountId, source: "upload", title: "Saree", words: {}, answers: {}, parts: [] })
    .returning();
  return garment!;
}

/** Store one uploaded photograph as a part, replacing any earlier one in that slot. */
export async function addUploadedPart(
  garment: Garment,
  slot: PartSlot,
  bytes: Uint8Array,
  mime: string,
  size: { width: number; height: number },
): Promise<Garment> {
  const key = await saveUpload(garment.id, slot, bytes, mime);
  const part: GarmentPartRow = { slot, key, url: assetUrl(key), width: size.width, height: size.height, rotate: 0 };
  const parts = [...garment.parts.filter((p) => p.slot !== slot), part];
  return updateGarment(garment.id, { parts });
}

export async function removePart(garment: Garment, slot: string): Promise<Garment> {
  return updateGarment(garment.id, { parts: garment.parts.filter((p) => p.slot !== slot) });
}

export async function getGarment(id: string, accountId: string): Promise<Garment | null> {
  const [row] = await db.select().from(garments).where(eq(garments.id, id)).limit(1);
  return row && row.accountId === accountId ? row : null;
}

export async function latestGarmentForCode(accountId: string, code: string): Promise<Garment | null> {
  const rows = await db.select().from(garments).where(eq(garments.productCode, code));
  return rows.filter((r) => r.accountId === accountId).sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null;
}

/** Parts change what the sheet shows, so the cached sheet goes with them. */
export async function updateGarment(
  id: string,
  patch: Partial<Pick<Garment, "words" | "answers" | "parts" | "title">>,
): Promise<Garment> {
  const resetSheet = patch.parts !== undefined;
  const [row] = await db
    .update(garments)
    .set({ ...patch, updatedAt: new Date(), ...(resetSheet ? { sheetKey: null } : {}) })
    .where(eq(garments.id, id))
    .returning();
  return row!;
}

/**
 * A garment as it is sent to the browser: part URLs recomputed from their
 * keys, so a local file keeps resolving however the server was started and
 * an R2 object follows the current public base.
 */
export function publicGarment(garment: Garment): Garment {
  return { ...garment, parts: garment.parts.map((p) => (p.key ? { ...p, url: assetUrl(p.key) } : p)) };
}

export function wordsFor(garment: Garment): GarmentWords {
  return garmentWordsFrom(garment.design, garment.words as DescribedGarment);
}

/** The parts the prompt will name, in reading order. */
export function presentSlots(garment: Garment): PartSlot[] {
  return PART_ORDER.filter((slot) => garment.parts.some((p) => p.slot === slot));
}

export function attachmentsFor(garment: Garment): Attachment[] {
  const stem = garment.productCode ?? garment.id.slice(0, 8);
  return presentSlots(garment).map((slot) => ({ slot, file: `${stem}-${slot}.png` }));
}

async function partBase64(part: GarmentPartRow): Promise<string> {
  if (part.key) return Buffer.from(await readAsset(part.key)).toString("base64");
  return fetchBase64(part.url);
}

/**
 * The labelled sheet: built from the parts the first time, stored in R2 when
 * storage is configured, read back after that. Without storage it is built
 * on every call — slow but honest.
 */
export async function sheetFor(garment: Garment): Promise<{ data: string; key: string | null }> {
  if (garment.sheetKey && storageConfigured()) {
    const bytes = await getObject(garment.sheetKey);
    return { data: Buffer.from(bytes).toString("base64"), key: garment.sheetKey };
  }

  const parts = await Promise.all(
    presentSlots(garment).map(async (slot) => {
      const part = garment.parts.find((p) => p.slot === slot)!;
      return { key: slot, label: slot.toUpperCase(), data: await partBase64(part), rotate: part.rotate };
    }),
  );
  if (parts.length === 0) throw new Error("This garment has no photographs yet.");
  const sheet = await buildContactSheet(parts, { cell: 1000 });

  if (!storageConfigured()) return { data: sheet.data, key: null };

  const key = keys.sheet(garment.id);
  await putObject(key, Buffer.from(sheet.data, "base64"), "image/png");
  await db.update(garments).set({ sheetKey: key, updatedAt: new Date() }).where(eq(garments.id, garment.id));
  return { data: sheet.data, key };
}
