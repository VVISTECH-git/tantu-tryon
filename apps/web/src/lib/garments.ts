import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, garments, type Garment, type GarmentPartRow, type PartQuality } from "@/db";
import { garmentWordsFrom, type DescribedGarment, type GarmentWords } from "@/content/garmentWords";
import type { Attachment, PartPlan } from "@/content/promptTemplates";
import { SHEET_CELLS, SHEET_FILL, SHEET_LEAD, garmentType, requiredSlots } from "@/content/shots";
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

/**
 * Labelled parts, in reading order. `saree` is one flat photograph of the
 * whole thing (the older upload path); the rest are the rod shots.
 */
export const PART_ORDER = ["saree", "body", "pallu", "border", "blouse", "body_motif", "pallu_motif", "whole"] as const;
export type PartSlot = (typeof PART_ORDER)[number];

export type GarmentResult = { ok: true; garment: Garment } | { ok: false; status: number; message: string };

/**
 * Enough to photograph: one flat photo of the whole saree, or every required
 * shot for the garment type, none of them blocked by the quality check.
 */
export function isReady(garment: Garment): boolean {
  if (garment.parts.some((p) => p.slot === "saree")) return true;
  return missingSlots(garment).length === 0;
}

/** The required shots still missing or blocked, for the message that says why Continue is off. */
export function missingSlots(garment: Garment): string[] {
  if (garment.parts.some((p) => p.slot === "saree")) return [];
  return requiredSlots(garment.garmentType).filter((slot) => {
    const part = garment.parts.find((p) => p.slot === slot);
    return part === undefined || part.quality?.status === "block";
  });
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

/** An empty garment for uploads to land in, of the type the merchant chose before uploading. */
export async function createUploadGarment(accountId: string, type: string): Promise<Garment> {
  const chosen = garmentType(type);
  const [garment] = await db
    .insert(garments)
    .values({ accountId, source: "upload", garmentType: chosen.value, family: chosen.family, title: chosen.label, words: {}, answers: {}, parts: [] })
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
  quality?: PartQuality,
  /** Already in storage (a presigned PUT from the phone): record it, do not write it again. */
  storedKey?: string,
): Promise<Garment> {
  const key = storedKey ?? (await saveUpload(garment.id, slot, bytes, mime));
  const part: GarmentPartRow = { slot, key, url: assetUrl(key), width: size.width, height: size.height, rotate: 0, ...(quality ? { quality } : {}) };
  const parts = [...garment.parts.filter((p) => p.slot !== slot), part];
  return updateGarment(garment.id, { parts, answers: blouseAnswer(garment, parts) });
}

export async function removePart(garment: Garment, slot: string): Promise<Garment> {
  const parts = garment.parts.filter((p) => p.slot !== slot);
  return updateGarment(garment.id, { parts, answers: blouseAnswer(garment, parts) });
}

/**
 * Whether the blouse is the body fabric, read from the photographs rather
 * than asked: a blouse-piece photo means a separate fabric; none means we
 * make a matching blouse. SLK garments keep the answer their design record gave.
 */
export function blouseAnswer(garment: Garment, parts: GarmentPartRow[]): Garment["answers"] {
  if (garment.source !== "upload") return garment.answers;
  return { ...garment.answers, blouseSameAsBody: !parts.some((p) => p.slot === "blouse") };
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
  // The blouse answer decides whether the blouse cell is on the sheet, so it resets it too.
  const resetSheet = patch.parts !== undefined || patch.answers !== undefined;
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

/** Every part present, in reading order. */
export function presentSlots(garment: Garment): PartSlot[] {
  return PART_ORDER.filter((slot) => garment.parts.some((p) => p.slot === slot));
}

/**
 * The parts that go on the sheet and are named in the prompt: at most four.
 *
 * One flat photo of the whole saree stands alone. Otherwise body, pallu and
 * border lead, and the remaining cells go to the first of blouse piece (only
 * when it is a separate fabric), pallu motif, body motif, whole hang that
 * exist. The rest stay on the record for a later regeneration.
 */
export function sheetSlots(garment: Garment): PartSlot[] {
  // A photograph the quality check blocked stays off the sheet: a blurred
  // border would be copied blurred. Required slots cannot be blocked here,
  // because `isReady` gates the call; this only drops optional ones.
  const present = new Set(
    presentSlots(garment).filter((slot) => garment.parts.find((p) => p.slot === slot)?.quality?.status !== "block"),
  );
  if (present.has("saree")) return ["saree"];
  // No border close-up beside a photographed pallu: the BORDER cell is cut
  // from the edges of the body photo, which the v2 wording expects. With the
  // body alone (one print) there is no BORDER cell: the body photograph shows
  // both borders at their real width, and v3 says so.
  if (!present.has("border") && present.has("body") && present.has("pallu")) present.add("border");
  const chosen: PartSlot[] = SHEET_LEAD.filter((slot) => present.has(slot));
  for (const slot of SHEET_FILL) {
    if (chosen.length >= SHEET_CELLS) break;
    if (!present.has(slot)) continue;
    if (slot === "blouse" && garment.answers.blouseSameAsBody) continue;
    chosen.push(slot);
  }
  return chosen;
}

export function attachmentsFor(garment: Garment): Attachment[] {
  const stem = garment.productCode ?? garment.id.slice(0, 8);
  const photographed = (slot: string) => garment.parts.some((p) => p.slot === slot && p.quality?.status !== "block");
  return sheetSlots(garment).map((slot) => ({
    slot,
    file: `${stem}-${slot}.png`,
    ...(slot === "border" && !photographed("border") ? { from: "body" as const } : {}),
  }));
}

/**
 * What the photographs say about the saree, for the prompt to adapt to.
 *
 * No pallu photo means the saree is one print end to end. No blouse photo
 * means a plain blouse in a complementary colour — except for an SLK product
 * whose design record says the blouse is self fabric, which is a fact, not a
 * gap. A single flat photograph of the whole saree keeps the older wording.
 */
export function partPlan(garment: Garment): PartPlan | undefined {
  const has = (slot: string) => garment.parts.some((p) => p.slot === slot && p.quality?.status !== "block");
  if (has("saree")) return undefined;
  return {
    pallu: has("pallu") ? "photo" : "same",
    border: has("border") ? "photo" : "from-body",
    blouse: has("blouse") ? "photo" : garment.source === "slk" && garment.answers.blouseSameAsBody ? "self" : "complementary",
  };
}

/**
 * The BORDER cell when no close-up was taken: the two long edges of the body
 * photo, each a strip about an eighth of the width, stood side by side at
 * full height. Both borders are shown so a wider hem border is not lost.
 * Enough for colour, width and a plain or zari-line design; a border with
 * figures of its own wants the close-up.
 */
export async function derivedBorder(bodyBase64: string, rotate: 0 | 90 | 180 | 270 = 0, height = 1000): Promise<string> {
  const upright = sharp(Buffer.from(bodyBase64, "base64")).rotate(rotate);
  const { width = 0, height: h = 0 } = await upright.metadata();
  const buf = await upright.toBuffer();
  const strip = Math.max(40, Math.round(width * 0.13));
  const scale = height / h;
  const stripW = Math.round(strip * scale);
  const gap = Math.round(height * 0.02);
  const left = await sharp(buf).extract({ left: 0, top: 0, width: strip, height: h }).resize({ width: stripW, height }).png().toBuffer();
  const right = await sharp(buf).extract({ left: width - strip, top: 0, width: strip, height: h }).resize({ width: stripW, height }).png().toBuffer();
  const out = await sharp({ create: { width: stripW * 2 + gap, height, channels: 3, background: "#ffffff" } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: stripW + gap, top: 0 }])
    .png()
    .toBuffer();
  return out.toString("base64");
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
export async function sheetFor(garment: Garment): Promise<{ data: string; key: string | null; mime: string }> {
  if (garment.sheetKey && storageConfigured()) {
    const bytes = await getObject(garment.sheetKey);
    const mime = garment.sheetKey.endsWith(".jpg") ? "image/jpeg" : "image/png";
    return { data: Buffer.from(bytes).toString("base64"), key: garment.sheetKey, mime };
  }

  const parts = await Promise.all(
    sheetSlots(garment).map(async (slot) => {
      const part = garment.parts.find((p) => p.slot === slot);
      if (!part && slot === "border") {
        const body = garment.parts.find((p) => p.slot === "body")!;
        return { key: slot, label: "BORDER", data: await derivedBorder(await partBase64(body), body.rotate) };
      }
      return { key: slot, label: slot.toUpperCase().replace("_", " "), data: await partBase64(part!), rotate: part!.rotate };
    }),
  );
  if (parts.length === 0) throw new Error("This garment has no photographs yet.");
  // Large panels from the originals: one panel at 2000px, more at 1600px
  // each, JPEG so the request stays well under Gemini's inline limit.
  const sheet = await buildContactSheet(parts, { cell: parts.length === 1 ? 2000 : 1600, format: "jpeg" });

  if (!storageConfigured()) return { data: sheet.data, key: null, mime: sheet.mime };

  const key = keys.sheet(garment.id, "jpg");
  await putObject(key, Buffer.from(sheet.data, "base64"), sheet.mime);
  await db.update(garments).set({ sheetKey: key, updatedAt: new Date() }).where(eq(garments.id, garment.id));
  return { data: sheet.data, key, mime: sheet.mime };
}
