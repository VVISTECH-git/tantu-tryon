import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, settings } from "@/db";

/**
 * The link for sharing the product photos with people outside (3 Nov):
 * /share/<token>, no sign-in. One token at a time; making a new one stops
 * the old link working.
 */
const KEY = "shareToken";

export async function shareToken(): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  return row?.value ?? null;
}

export async function newShareToken(): Promise<string> {
  const token = randomBytes(12).toString("base64url");
  await db
    .insert(settings)
    .values({ key: KEY, value: token })
    .onConflictDoUpdate({ target: settings.key, set: { value: token, updatedAt: new Date() } });
  return token;
}

export async function isShareToken(token: string): Promise<boolean> {
  const t = await shareToken();
  return !!t && t.length === token.length && t === token;
}
