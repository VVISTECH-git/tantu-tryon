import { and, desc, eq } from "drizzle-orm";
import { db, garments, generations } from "@/db";
import { toOutput } from "@/lib/generate";
import { requireAccount, unauthorised } from "@/lib/session";
import { sweepStale } from "@/lib/spend";

export const runtime = "nodejs";

/** The gallery: every finished image this account has made, newest first. */
export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    await sweepStale();
    const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 60)));
    const rows = await db
      .select({ generation: generations, title: garments.title, code: garments.productCode })
      .from(generations)
      .innerJoin(garments, eq(generations.garmentId, garments.id))
      .where(and(eq(generations.accountId, account.id), eq(generations.status, "done")))
      .orderBy(desc(generations.startedAt))
      .limit(limit);
    return Response.json(
      {
        generations: rows.map(({ generation: row, title, code }) => ({
          ...toOutput(row),
          garmentId: row.garmentId,
          garmentTitle: title,
          productCode: code,
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
    return unauthorised(error) ?? Response.json({ error: "Could not load your images." }, { status: 500 });
  }
}
