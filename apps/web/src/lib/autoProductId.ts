import { and, eq, isNull, sql } from "drizzle-orm";
import { db, garments, settings, type Garment } from "@/db";
import { garmentType } from "@/content/shots";

/**
 * Product IDs given out automatically for the photographer login (28 Sep):
 * 9001, 9002, … per shop, with no number lost and none shared.
 *
 * - A number is held by the phone it was given to until a photo is saved
 *   under it: Continue, Back, Continue again gives the same number.
 * - Another phone never gets a held number, so two phones cannot end up in
 *   one record (the first version reused any empty number and let two phones
 *   tapping together share one, caught in testing).
 * - A number left without photos for STALE_MS (a phone that walked away), or
 *   held by no phone at all, is taken back and given to the next phone that
 *   asks, lowest first.
 * - A number someone typed or scanned by hand is stepped over, and its
 *   record is never taken back: only records marked autoIssued are.
 *
 * All of it runs under one lock per shop, so each decision sees the last.
 */
export const FIRST_AUTO_ID = 9001;
const STALE_MS = 2 * 60 * 60 * 1000;

const counterKey = (accountId: string) => `autoProductId:${accountId}`;
const heldKey = (accountId: string, device: string) => `autoProductHeld:${accountId}:${device}`;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Plan = { kind: "held" | "reclaim"; garment: Garment } | { kind: "new"; code: string };

/** The phone's own id, sent as x-tantu-device; anything else is ignored. */
export function deviceFrom(request: Request): string | null {
  const id = request.headers.get("x-tantu-device") ?? "";
  return /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

async function plan(tx: Tx | typeof db, accountId: string, device: string | null): Promise<{ plan: Plan; last: number }> {
  const [counter] = await tx.select().from(settings).where(eq(settings.key, counterKey(accountId))).limit(1);
  const last = counter ? Number(counter.value) : FIRST_AUTO_ID - 1;

  if (device) {
    const [held] = await tx.select().from(settings).where(eq(settings.key, heldKey(accountId, device))).limit(1);
    if (held) {
      const [g] = await tx.select().from(garments).where(and(eq(garments.id, held.value), isNull(garments.deletedAt))).limit(1);
      if (g && g.parts.length === 0) return { plan: { kind: "held", garment: g }, last };
    }
  }

  const rows = await tx
    .select()
    .from(garments)
    .where(and(eq(garments.accountId, accountId), isNull(garments.deletedAt), sql`${garments.productCode} ~ '^[0-9]+$'`));
  // Held by no phone (given out before holds existed), or held but left alone too long.
  const holds = await tx.select({ value: settings.value }).from(settings).where(sql`${settings.key} like ${`autoProductHeld:${accountId}:%`}`);
  const heldIds = new Set(holds.map((h) => h.value));
  const staleBefore = Date.now() - STALE_MS;
  const stale = rows
    .filter((g) => g.autoIssued && g.parts.length === 0 && (!heldIds.has(g.id) || +g.updatedAt < staleBefore))
    .map((g) => ({ g, n: Number(g.productCode) }))
    .filter(({ n }) => n >= FIRST_AUTO_ID && n <= last)
    .sort((a, b) => a.n - b.n)[0];
  if (stale) return { plan: { kind: "reclaim", garment: stale.g }, last };

  const taken = new Set(rows.map((g) => Number(g.productCode)));
  let next = last + 1;
  while (taken.has(next)) next++;
  return { plan: { kind: "new", code: String(next) }, last };
}

/** The ID this phone's next Continue will get, shown before it is tapped. */
export async function peekAutoProductId(accountId: string, device: string | null): Promise<string> {
  const { plan: p } = await plan(db, accountId, device);
  return p.kind === "new" ? p.code : p.garment.productCode!;
}

/** Give this phone its number (the one it holds, a reclaimed one, or the next) and open its record. */
export async function openAutoProduct(accountId: string, type: string, device: string | null): Promise<Garment> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${counterKey(accountId)}))`);
    const { plan: p } = await plan(tx, accountId, device);
    let garment: Garment;
    if (p.kind === "new") {
      await tx
        .insert(settings)
        .values({ key: counterKey(accountId), value: p.code })
        .onConflictDoUpdate({ target: settings.key, set: { value: p.code, updatedAt: new Date() } });
      const chosen = garmentType(type);
      [garment] = (await tx
        .insert(garments)
        .values({ accountId, source: "upload", productCode: p.code, garmentType: chosen.value, family: chosen.family, title: `${chosen.label} ${p.code}`, words: {}, answers: {}, parts: [], autoIssued: true })
        .returning()) as [Garment];
    } else {
      if (p.kind === "reclaim") {
        // The phone that walked away no longer holds it: it gets a fresh number when it comes back.
        await tx.delete(settings).where(and(sql`${settings.key} like ${`autoProductHeld:${accountId}:%`}`, eq(settings.value, p.garment.id)));
      }
      // Touched, so it counts as fresh again and no other phone reclaims it.
      [garment] = (await tx.update(garments).set({ updatedAt: new Date() }).where(eq(garments.id, p.garment.id)).returning()) as [Garment];
    }
    if (device) {
      await tx
        .insert(settings)
        .values({ key: heldKey(accountId, device), value: garment.id })
        .onConflictDoUpdate({ target: settings.key, set: { value: garment.id, updatedAt: new Date() } });
    }
    return garment;
  });
}
