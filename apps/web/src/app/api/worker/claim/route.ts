import { and, asc, eq, sql } from "drizzle-orm";
import { db, garments, generations } from "@/db";
import { QWEN_PROVIDER, qwenInputs, qwenSize } from "@/lib/qwenPrompt";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { assetUrl } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * The laptop worker's door (8 Oct). It signs in as the platform admin (the
 * laptop's own token) and asks for the oldest queued Qwen job; the row goes
 * to running so no second worker takes it. GET only reports the queue.
 */
export async function GET() {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const [row] = await db
      .select({
        queued: sql<number>`count(*) filter (where ${generations.status} = 'queued')::int`,
        running: sql<number>`count(*) filter (where ${generations.status} = 'running')::int`,
      })
      .from(generations)
      .where(eq(generations.provider, QWEN_PROVIDER));
    return Response.json({ queued: row?.queued ?? 0, running: row?.running ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read the queue." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const job = await db.transaction(async (tx) => {
      const [next] = await tx
        .select()
        .from(generations)
        .where(and(eq(generations.provider, QWEN_PROVIDER), eq(generations.status, "queued")))
        .orderBy(asc(generations.startedAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!next) return null;
      await tx.update(generations).set({ status: "running", startedAt: new Date() }).where(eq(generations.id, next.id));
      return next;
    });
    if (!job) return Response.json({ job: null }, { headers: { "Cache-Control": "no-store" } });
    const [garment] = await db.select().from(garments).where(eq(garments.id, job.garmentId)).limit(1);
    if (!garment) return Response.json({ job: null }, { headers: { "Cache-Control": "no-store" } });
    const size = qwenSize(job.look.quality);
    // A seed from the row id: the same job retried draws the same picture.
    const seed = parseInt(job.id.replace(/-/g, "").slice(0, 8), 16) % 2_000_000_000;
    return Response.json(
      {
        job: {
          id: job.id,
          promptId: job.promptId,
          prompt: job.promptText,
          width: size.width,
          height: size.height,
          upscale: size.upscale,
          seed,
          garmentType: garment.garmentType,
          productCode: garment.productCode,
          images: qwenInputs(garment).map((p) => ({ slot: p.slot, url: assetUrl(p.key) })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not claim a job." }, { status: 500 });
  }
}
