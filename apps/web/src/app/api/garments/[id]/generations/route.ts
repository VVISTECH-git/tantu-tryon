import { asc, eq } from "drizzle-orm";
import { db, generations } from "@/db";
import { getGarment } from "@/lib/garments";
import { toOutput } from "@/lib/generate";
import { requireAccount, unauthorised } from "@/lib/session";
import { sweepStale } from "@/lib/spend";

export const runtime = "nodejs";

/** Everything made for a garment, oldest first. Stale rows are settled on the way in. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    const { id } = await params;
    const garment = await getGarment(id, account.id);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });
    await sweepStale();
    const rows = await db.select().from(generations).where(eq(generations.garmentId, id)).orderBy(asc(generations.startedAt));
    return Response.json(
      {
        generations: rows.map((row) => ({
          ...toOutput(row),
          promptId: row.promptId,
          promptVersion: row.promptVersion,
          look: row.look,
          verdict: row.verdict,
          note: row.note,
          startedAt: row.startedAt,
          clientKey: row.clientKey,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not list the runs." }, { status: 500 });
  }
}
