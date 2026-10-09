import { and, isNull, sql } from "drizzle-orm";
import { accounts, db } from "@/db";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Make a Google-signed-in account a platform admin (9 Oct: the owner signs in to tantu-two with
 * Google, bhanuboddu09@gmail.com, and asked for it to be the admin). Platform admin only.
 *
 *   { email }  → { ok, id, name }
 */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const body = (await request.json().catch(() => ({}))) as { email?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: "Enter an email." }, { status: 400 });
    const [row] = await db
      .update(accounts)
      .set({ platformAdmin: true })
      .where(and(sql`lower(${accounts.email}) = ${email}`, isNull(accounts.workspaceId)))
      .returning({ id: accounts.id, name: accounts.name });
    if (!row) return Response.json({ error: "No account with that email has signed in yet." }, { status: 404 });
    return Response.json({ ok: true, ...row });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not update the account." }, { status: 500 });
  }
}
