import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { accounts, db, garments, partLabels, type Account, type PartLabel, type PartRegion } from "@/db";
import { isHouseShop } from "@/lib/session";
import { assetUrl, headObject, presignPut, putObject } from "@/lib/storage";

/**
 * Training photos for Tantu's own part finder (4 Oct): marked on the laptop,
 * checked here by operations staff. Private — the photos are served through
 * a signed-in route, never from the public bucket address.
 */

export const PART_COLOURS: Record<string, string> = {
  Body: "#2e86de",
  Pallu: "#e84393",
  "Bottom border": "#e67e22",
  "Top border": "#f1c40f",
  Blouse: "#27ae60",
};

export const VERDICTS = ["pending", "approved", "wrong"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** The platform admin, and the house shop's owner and studio logins. */
export function canReviewLabels(account: Account): boolean {
  return account.platformAdmin || (isHouseShop(account) && (account.role === "owner" || account.role === "studio"));
}

const safe = (source: string) => source.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();

export interface LabelUpload {
  source: string;
  taskNo?: number | null;
  width: number;
  height: number;
  regions: PartRegion[];
  style?: string | null;
  palluKind?: string | null;
  /** The screen-sized JPEG, base64. */
  preview: string;
  /** The original's type, when the laptop will send it next. */
  originalType?: string;
  /** When the photo is one of a product's: its product ID and slot (body, pallu, …). */
  productCode?: string | null;
  slot?: string | null;
  /** The website crop the laptop has already taken in, if any. */
  syncedEdit?: string | null;
}

/** The photo was cropped on the website after the laptop last took it in. */
export class CroppedOnWebsite extends Error {
  constructor(source: string) {
    super(`${source} was cropped on the website: take the new photo first (upload_labels.py does).`);
    this.name = "CroppedOnWebsite";
  }
}

/** The live product with this ID that has a photo in this slot, and that photo's key. */
async function productPhoto(productCode: string, slot: string): Promise<{ id: string; key: string | null } | null> {
  const rows = await db
    .select({ id: garments.id, parts: garments.parts })
    .from(garments)
    .where(and(eq(garments.productCode, productCode), isNull(garments.deletedAt)))
    .orderBy(desc(garments.updatedAt));
  for (const g of rows) {
    const part = g.parts.find((p) => p.slot === slot);
    if (part) return { id: g.id, key: part.key ?? null };
  }
  return null;
}

/**
 * Add or update one photo. Changed marks go back to "pending" so staff check
 * the fix; the earlier note stays, so they can see what was asked for.
 * Returns where to PUT the original, when the bucket does not have it yet.
 */
export async function saveLabel(u: LabelUpload): Promise<{ id: string; status: string; originalUrl: string | null }> {
  const dir = `labelling/${safe(u.source)}`;
  const previewKey = `${dir}/preview.jpg`;
  const ext = (u.originalType ?? "image/jpeg").split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const photoKey = `${dir}/original.${ext}`;
  const [before] = await db.select().from(partLabels).where(eq(partLabels.source, u.source)).limit(1);
  if (before?.photoEditedAt && !(u.syncedEdit && new Date(u.syncedEdit) >= before.photoEditedAt)) throw new CroppedOnWebsite(u.source);
  await putObject(previewKey, Buffer.from(u.preview, "base64"), "image/jpeg");
  const product = u.productCode && u.slot ? await productPhoto(u.productCode, u.slot) : null;
  const garmentId = product?.id ?? null;
  const values = {
    taskNo: u.taskNo ?? null,
    garmentId,
    // The product photo these marks belong to, fixed the first time they are linked.
    productPhotoKey: before?.productPhotoKey ?? product?.key ?? null,
    slot: garmentId ? u.slot! : null,
    photoKey,
    previewKey,
    width: u.width,
    height: u.height,
    regions: u.regions,
    style: u.style ?? null,
    palluKind: u.palluKind ?? null,
    updatedAt: new Date(),
  };
  let row: PartLabel;
  if (before) {
    const changed =
      JSON.stringify(before.regions) !== JSON.stringify(u.regions) ||
      before.style !== values.style ||
      before.palluKind !== values.palluKind;
    [row] = await db
      .update(partLabels)
      .set({ ...values, ...(changed ? { status: "pending", reviewedBy: null, reviewedAt: null } : {}) })
      .where(eq(partLabels.id, before.id))
      .returning();
  } else {
    [row] = await db.insert(partLabels).values({ source: u.source, ...values }).returning();
  }
  const have = u.originalType ? await headObject(photoKey) : { size: 1 };
  return {
    id: row!.id,
    status: row!.status,
    originalUrl: have ? null : await presignPut(photoKey, u.originalType!, 900),
  };
}

/** The slots photographed on the rod, which the laptop can mark by the rod rules. */
export const AUTO_SLOTS = ["body", "pallu", "border", "blouse"] as const;

export interface PhotoToMark {
  garmentId: string;
  productCode: string | null;
  slot: string;
  key: string;
  url: string;
  takenAt: string | null;
}

/**
 * The house shop's product photos with no marks yet, or whose photo changed
 * since it was marked (a retake), oldest first: what the laptop marks next.
 */
export async function photosToMark(limit = 200): Promise<PhotoToMark[]> {
  const rows = await db
    .select({ id: garments.id, productCode: garments.productCode, parts: garments.parts })
    .from(garments)
    .innerJoin(accounts, eq(garments.accountId, accounts.id))
    .where(and(isNull(garments.deletedAt), eq(accounts.kind, "shared")));
  const marks = await labelsForProducts(rows.map((r) => r.id));
  const out: PhotoToMark[] = [];
  for (const g of rows) {
    for (const p of g.parts) {
      if (!p.key || !(AUTO_SLOTS as readonly string[]).includes(p.slot)) continue;
      const mark = marks.find((m) => m.garmentId === g.id && m.slot === p.slot);
      if (mark && (!mark.productPhotoKey || mark.productPhotoKey === p.key)) continue;
      out.push({ garmentId: g.id, productCode: g.productCode, slot: p.slot, key: p.key, url: assetUrl(p.key), takenAt: p.takenAt ?? null });
    }
  }
  return out.sort((a, b) => (a.takenAt ?? "").localeCompare(b.takenAt ?? "")).slice(0, limit);
}

export interface AutoMarks {
  garmentId: string;
  slot: string;
  /** The photo the laptop marked; refused if the product has a newer one by now. */
  key: string;
  width: number;
  height: number;
  regions: PartRegion[];
  style?: string | null;
  preview: string;
}

/**
 * Marks the laptop made by itself on a product photo, for staff to check.
 * A retake replaces the earlier marks on that photo slot, whoever made them.
 */
export async function saveAutoMarks(u: AutoMarks): Promise<{ id: string } | null> {
  const [g] = await db.select({ parts: garments.parts }).from(garments).where(eq(garments.id, u.garmentId)).limit(1);
  if (g?.parts.find((p) => p.slot === u.slot)?.key !== u.key) return null; // retaken meanwhile: marked on the next round
  const [before] = await db
    .select()
    .from(partLabels)
    .where(and(eq(partLabels.garmentId, u.garmentId), eq(partLabels.slot, u.slot)))
    .limit(1);
  const source = before?.source ?? `tantu-${u.garmentId}-${u.slot}`;
  const previewKey = `labelling/${safe(source)}/preview.jpg`;
  await putObject(previewKey, Buffer.from(u.preview, "base64"), "image/jpeg");
  const values = {
    garmentId: u.garmentId,
    slot: u.slot,
    productPhotoKey: u.key,
    photoKey: u.key,
    previewKey,
    width: u.width,
    height: u.height,
    regions: u.regions,
    style: u.style ?? null,
    status: "pending",
    note: null,
    reviewedBy: null,
    reviewedAt: null,
    updatedAt: new Date(),
  };
  if (before) {
    // A laptop-marked photo replaced by a retake: the laptop takes the new photo and marks from here.
    const [row] = await db
      .update(partLabels)
      .set({ ...values, ...(before.taskNo != null ? { photoEditedAt: new Date() } : {}) })
      .where(eq(partLabels.id, before.id))
      .returning();
    return { id: row!.id };
  }
  const [row] = await db.insert(partLabels).values({ source, ...values }).returning();
  return { id: row!.id };
}

export async function listLabels(): Promise<PartLabel[]> {
  return db.select().from(partLabels).orderBy(asc(partLabels.taskNo), asc(partLabels.source));
}

/** Marks for these products, so the Products page can draw them on each photo. */
export async function labelsForProducts(garmentIds: string[]): Promise<PartLabel[]> {
  if (garmentIds.length === 0) return [];
  return db.select().from(partLabels).where(inArray(partLabels.garmentId, garmentIds));
}

export async function labelById(id: string): Promise<PartLabel | null> {
  const [row] = await db.select().from(partLabels).where(eq(partLabels.id, id)).limit(1);
  return row ?? null;
}

export async function setVerdict(id: string, status: Verdict, note: string | null, who: string): Promise<PartLabel | null> {
  const [row] = await db
    .update(partLabels)
    .set({ status, note, reviewedBy: status === "pending" ? null : who, reviewedAt: status === "pending" ? null : new Date() })
    .where(eq(partLabels.id, id))
    .returning();
  return row ?? null;
}
