import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, garments, partLabels, type Account, type PartLabel, type PartRegion } from "@/db";
import { isHouseShop } from "@/lib/session";
import { putObject, headObject, presignPut } from "@/lib/storage";

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
}

/** The live product with this ID that has a photo in this slot. */
async function productPhoto(productCode: string, slot: string): Promise<string | null> {
  const rows = await db
    .select({ id: garments.id, parts: garments.parts })
    .from(garments)
    .where(and(eq(garments.productCode, productCode), isNull(garments.deletedAt)))
    .orderBy(desc(garments.updatedAt));
  const hit = rows.find((g) => ((g.parts ?? []) as { slot?: string }[]).some((p) => p.slot === slot));
  return hit?.id ?? null;
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
  await putObject(previewKey, Buffer.from(u.preview, "base64"), "image/jpeg");

  const [before] = await db.select().from(partLabels).where(eq(partLabels.source, u.source)).limit(1);
  const garmentId = u.productCode && u.slot ? await productPhoto(u.productCode, u.slot) : null;
  const values = {
    taskNo: u.taskNo ?? null,
    garmentId,
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
      .set({ ...values, ...(changed ? { status: "pending" } : {}) })
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
