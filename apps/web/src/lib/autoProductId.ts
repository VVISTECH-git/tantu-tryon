import { and, eq, isNull, sql } from "drizzle-orm";
import { db, garments, settings, type Garment } from "@/db";
import { garmentType } from "@/content/shots";

/**
 * Product IDs given out automatically for the photographer login (28 Sep):
 * 9001, 9002, … per shop. The counter lives in `settings` and is advanced
 * under a lock, so two phones never get the same number, and a number
 * someone typed in by hand is stepped over. A number is never handed out
 * twice: reusing one whose record was left without photos let two phones
 * tapping Continue together share one record (caught in testing). Backing out
 * before any photo therefore leaves a gap, and its empty record is not listed.
 */
export const FIRST_AUTO_ID = 9001;

const counterKey = (accountId: string) => `autoProductId:${accountId}`;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function plan(tx: Tx | typeof db, accountId: string): Promise<number> {
  const [counter] = await tx.select().from(settings).where(eq(settings.key, counterKey(accountId))).limit(1);
  const last = counter ? Number(counter.value) : FIRST_AUTO_ID - 1;
  const rows = await tx
    .select()
    .from(garments)
    .where(and(eq(garments.accountId, accountId), isNull(garments.deletedAt), sql`${garments.productCode} ~ '^[0-9]+$'`));
  const taken = new Set(rows.map((g) => Number(g.productCode)));
  let next = last + 1;
  while (taken.has(next)) next++;
  return next;
}

/** The ID the next Continue would get, to show on the phone before it is tapped. */
export async function peekAutoProductId(accountId: string): Promise<string> {
  return String(await plan(db, accountId));
}

/** Give out the next ID and open its record. */
export async function openAutoProduct(accountId: string, type: string): Promise<Garment> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${counterKey(accountId)}))`);
    const code = String(await plan(tx, accountId));
    await tx
      .insert(settings)
      .values({ key: counterKey(accountId), value: code })
      .onConflictDoUpdate({ target: settings.key, set: { value: code, updatedAt: new Date() } });
    const chosen = garmentType(type);
    const [garment] = await tx
      .insert(garments)
      .values({ accountId, source: "upload", productCode: code, garmentType: chosen.value, family: chosen.family, title: `${chosen.label} ${code}`, words: {}, answers: {}, parts: [] })
      .returning();
    return garment!;
  });
}
