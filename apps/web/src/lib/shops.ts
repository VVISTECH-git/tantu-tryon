import { and, eq, isNull, sql } from "drizzle-orm";
import { accounts, creditLedger, db, garments, generations } from "@/db";

/**
 * Every shop on the platform, for the platform admin: who owns it, what it
 * has left to spend, and how much it has used. A shop is an account with no
 * workspace; the people added to it point at it.
 */
export interface ShopRow {
  id: string;
  name: string;
  owner: string | null;
  house: boolean;
  balancePaise: number;
  people: number;
  products: number;
  images: number;
  createdAt: Date;
}

export async function listShops(): Promise<ShopRow[]> {
  const shops = await db.select().from(accounts).where(isNull(accounts.workspaceId));
  const people = await db
    .select({ shop: accounts.workspaceId, n: sql<number>`count(*)::int` })
    .from(accounts)
    .where(sql`${accounts.workspaceId} is not null`)
    .groupBy(accounts.workspaceId);
  const balances = await db
    .select({ shop: creditLedger.accountId, paise: sql<number>`coalesce(sum(${creditLedger.deltaPaise}), 0)::int` })
    .from(creditLedger)
    .groupBy(creditLedger.accountId);
  const products = await db
    .select({ shop: garments.accountId, n: sql<number>`count(*)::int` })
    .from(garments)
    .groupBy(garments.accountId);
  const images = await db
    .select({ shop: generations.accountId, n: sql<number>`count(*)::int` })
    .from(generations)
    .where(and(eq(generations.status, "done")))
    .groupBy(generations.accountId);
  const count = (rows: { shop: string | null; n: number }[], id: string) => rows.find((r) => r.shop === id)?.n ?? 0;
  return shops
    .map((s) => ({
      id: s.id,
      name: s.name,
      owner: s.username,
      house: s.kind === "shared",
      balancePaise: balances.find((b) => b.shop === s.id)?.paise ?? 0,
      people: count(people, s.id),
      products: count(products, s.id),
      images: count(images, s.id),
      createdAt: s.createdAt,
    }))
    .sort((a, b) => Number(b.house) - Number(a.house) || +a.createdAt - +b.createdAt);
}
