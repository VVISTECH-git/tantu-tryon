import { and, eq } from "drizzle-orm";
import { db, generations } from "@/db";
import { QWEN_PROVIDER } from "@/lib/qwenPrompt";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { finishGeneration } from "@/lib/spend";
import { extensionFor, keys, presignPut } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * The laptop worker reporting back (8 Oct).
 *
 * `{ id, contentType }` first: a signed URL to PUT the finished picture to
 * (a 2K PNG can pass the request size a function may carry).
 * Then `{ id, key, mime, ms }` for a picture, or `{ id, error }` when the
 * laptop could not make one; the row closes and the shop's credits come back.
 */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const body = (await request.json().catch(() => ({}))) as { id?: string; contentType?: string; key?: string; mime?: string; ms?: number; error?: string };
    if (!body.id) return Response.json({ error: "Which job?" }, { status: 400 });
    const [row] = await db
      .select({ id: generations.id, garmentId: generations.garmentId, status: generations.status })
      .from(generations)
      .where(and(eq(generations.id, body.id), eq(generations.provider, QWEN_PROVIDER)))
      .limit(1);
    if (!row) return Response.json({ error: "No such job." }, { status: 404 });

    if (body.contentType) {
      const mime = body.contentType === "image/jpeg" ? "image/jpeg" : "image/png";
      const key = keys.render(row.garmentId, row.id, extensionFor(mime));
      return Response.json({ key, url: await presignPut(key, mime, 900), mime }, { headers: { "Cache-Control": "no-store" } });
    }
    if (row.status !== "running") return Response.json({ error: `The job is ${row.status}, not running.` }, { status: 409 });
    if (body.key) {
      await finishGeneration(row.id, { ok: true, imageKey: body.key, imageMime: body.mime ?? "image/png", ms: Math.max(0, Math.round(body.ms ?? 0)) });
    } else {
      await finishGeneration(row.id, { ok: false, status: "failed", error: String(body.error ?? "The laptop could not make the image.").slice(0, 2000), billed: false, ms: body.ms });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not finish the job." }, { status: 500 });
  }
}
