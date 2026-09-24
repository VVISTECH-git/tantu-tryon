import { and, eq } from "drizzle-orm";
import { db, generations } from "@/db";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** The verdict and the note: the record that says whether a prompt works. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { verdict?: unknown; note?: unknown };
    const set: Partial<{ verdict: string | null; note: string }> = {};
    if (body.verdict === "approved" || body.verdict === "rejected" || body.verdict === null) set.verdict = body.verdict;
    if (typeof body.note === "string") set.note = body.note.slice(0, 1000);
    if (Object.keys(set).length === 0) return Response.json({ error: "Nothing to change." }, { status: 400 });

    const [row] = await db
      .update(generations)
      .set(set)
      .where(and(eq(generations.id, id), eq(generations.accountId, account.id)))
      .returning({ id: generations.id, verdict: generations.verdict, note: generations.note });
    if (!row) return Response.json({ error: "No such run." }, { status: 404 });
    return Response.json(row, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not update the run." }, { status: 500 });
  }
}
