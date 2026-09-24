import { setPassword, accountByUsername } from "@/lib/session";
import { db, accounts } from "@/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * TEMPORARY, one-time provisioning route. Sets an account's username and
 * password, gated by ADMIN_SETUP_TOKEN — a random secret pushed to this
 * deployment and never committed. Deleted from the codebase right after use.
 */
export async function POST(request: Request) {
  const token = request.headers.get("x-setup-token");
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected || token !== expected) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string; displayName?: string };
  if (!body.username || !body.password) {
    return Response.json({ error: "username and password required." }, { status: 400 });
  }

  let account = await accountByUsername(body.username);
  if (!account) {
    const [legacy] = await db.select().from(accounts).where(eq(accounts.kind, "shared")).limit(1);
    account = legacy ?? null;
  }
  if (!account) {
    const [created] = await db.insert(accounts).values({ name: body.displayName ?? body.username, kind: "shared" }).returning();
    account = created!;
  }

  await setPassword(account.id, body.username, body.password);
  return Response.json({ ok: true, accountId: account.id, accountName: account.name });
}
