import { and, eq, like } from "drizzle-orm";
import { db, garments, generations, type GenerationLook } from "@/db";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { limits, listCostPaise } from "@/lib/spend";
import { headObject, keys, presignPut } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * An image made outside the website — the laptop calling Gemini with the key directly (8 Oct) —
 * recorded as a generation, so it shows on the product and on the Generations page with its
 * prompt and Google's cost. Platform admin only; no Tantu credit.
 *
 *   { garmentId, promptId, promptText, model, size, look, clientKey }  → { id, key, url }  (PUT the PNG to url)
 *   { id, key, ms }                                                    → the row closes as done
 */
/** GET ?prefix=laptop-pairs-v2- → [{ clientKey, verdict }]: the Review page's marks, for building a training set. */
export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const prefix = new URL(request.url).searchParams.get("prefix") ?? "laptop-";
    if (!/^[\w-]+$/.test(prefix)) return Response.json({ error: "Bad prefix." }, { status: 400 });
    const rows = await db.select({ clientKey: generations.clientKey, verdict: generations.verdict }).from(generations).where(like(generations.clientKey, `${prefix}%`));
    return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not read." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      key?: string;
      ms?: number;
      garmentId?: string;
      promptId?: string;
      promptText?: string;
      model?: string;
      size?: "1K" | "2K" | "4K";
      look?: GenerationLook;
      clientKey?: string;
    };

    if (body.id && body.key) {
      if (!(await headObject(body.key))) return Response.json({ error: "The image did not arrive." }, { status: 409 });
      await db
        .update(generations)
        .set({ status: "done", imageKey: body.key, imageMime: "image/png", ms: Math.max(0, Math.round(body.ms ?? 0)), finishedAt: new Date() })
        .where(and(eq(generations.id, body.id), eq(generations.status, "running")));
      return Response.json({ ok: true });
    }

    if (!body.garmentId || !body.promptId || !body.promptText || !body.model || !body.look || !body.clientKey) {
      return Response.json({ error: "garmentId, promptId, promptText, model, look and clientKey are required." }, { status: 400 });
    }
    const [garment] = await db.select({ id: garments.id }).from(garments).where(eq(garments.id, body.garmentId)).limit(1);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });
    const [dup] = await db.select({ id: generations.id, imageKey: generations.imageKey }).from(generations).where(eq(generations.clientKey, body.clientKey)).limit(1);
    if (dup) return Response.json({ id: dup.id, existing: true, done: Boolean(dup.imageKey) });

    const lim = await limits();
    const size = body.size ?? "1K";
    const costPaise = await listCostPaise(body.model, size === "4K" ? "4K" : size === "2K" ? "2K" : "1K", lim.ratePaisePerUsd);
    const [row] = await db
      .insert(generations)
      .values({
        clientKey: body.clientKey,
        accountId: account.id,
        garmentId: body.garmentId,
        promptId: body.promptId,
        promptVersion: "garment-v1 · laptop",
        promptText: body.promptText.slice(0, 8000),
        look: body.look,
        provider: "gemini",
        model: body.model,
        status: "running",
        costPaise,
        ratePaisePerUsd: lim.ratePaisePerUsd,
        creditsPaise: 0,
      })
      .returning({ id: generations.id });
    const key = keys.render(body.garmentId, row!.id, "png");
    return Response.json({ id: row!.id, key, url: await presignPut(key, "image/png", 900) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not import." }, { status: 500 });
  }
}
