import { and, asc, eq, lt, sql } from "drizzle-orm";
import { db, generations } from "@/db";
import { toOutput } from "@/lib/generate";
import { QWEN_PROVIDER } from "@/lib/qwenPrompt";
import { requireAccount, unauthorised } from "@/lib/session";
import { sweepStale } from "@/lib/spend";

export const runtime = "nodejs";

/**
 * One run, as the studio polls it while the laptop works (8 Oct). `ahead` is
 * how many queued laptop jobs come before this one; `queued` and `running`
 * only mean something for the Qwen track.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    const { id } = await params;
    await sweepStale();
    const [row] = await db
      .select()
      .from(generations)
      .where(and(eq(generations.id, id), eq(generations.accountId, account.id)))
      .orderBy(asc(generations.startedAt))
      .limit(1);
    if (!row) return Response.json({ error: "No such run." }, { status: 404 });
    let ahead = 0;
    if (row.status === "queued") {
      const [n] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(generations)
        .where(and(eq(generations.provider, QWEN_PROVIDER), eq(generations.status, "queued"), lt(generations.startedAt, row.startedAt)));
      ahead = n?.n ?? 0;
    }
    return Response.json(
      {
        generation: {
          ...toOutput(row),
          promptId: row.promptId,
          promptVersion: row.promptVersion,
          look: row.look,
          verdict: row.verdict,
          note: row.note,
          startedAt: row.startedAt,
          clientKey: row.clientKey,
          ahead,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read the run." }, { status: 500 });
  }
}

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
