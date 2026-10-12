import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { accounts, db, garments, generations } from "@/db";
import { requireAccount, unauthorised } from "@/lib/session";
import { assetUrl, saveRender } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Pose testing (12 Oct, user: testers run each pose in the Gemini app and upload the result here).
 * A result is kept as a generation of the product, made by "gemini-app", with the tester's verdict
 * and note, so every tester's pictures for a pose sit side by side.
 *
 *   GET  ?product=KW-0015                                   → { results: [...] }
 *   POST multipart: file, product, pose, verdict, note, prompt → { ok, id }
 */
const PROVIDER = "gemini-app";

async function productId(code: string): Promise<string | null> {
  const [g] = await db
    .select({ id: garments.id })
    .from(garments)
    .where(and(eq(garments.productCode, code), isNull(garments.deletedAt)))
    .orderBy(asc(garments.createdAt))
    .limit(1);
  return g?.id ?? null;
}

export async function GET(request: Request) {
  try {
    await requireAccount();
    const code = (new URL(request.url).searchParams.get("product") ?? "").trim().slice(0, 40);
    const gid = code ? await productId(code) : null;
    if (!gid) return Response.json({ results: [] }, { headers: { "Cache-Control": "no-store" } });
    const rows = await db
      .select({ id: generations.id, pose: generations.promptId, imageKey: generations.imageKey, verdict: generations.verdict, note: generations.note, at: generations.startedAt, tester: accounts.name })
      .from(generations)
      .innerJoin(accounts, eq(accounts.id, generations.accountId))
      .where(and(eq(generations.garmentId, gid), eq(generations.provider, PROVIDER)))
      .orderBy(desc(generations.startedAt));
    return Response.json(
      { results: rows.filter((r) => r.imageKey).map((r) => ({ id: r.id, pose: r.pose, url: assetUrl(r.imageKey!), verdict: r.verdict, note: r.note, at: r.at, tester: r.tester })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not load the results." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const form = await request.formData();
    const file = form.get("file");
    const code = String(form.get("product") ?? "").trim().slice(0, 40);
    const pose = String(form.get("pose") ?? "").trim().slice(0, 60);
    const verdict = form.get("verdict") === "good" ? "approved" : form.get("verdict") === "fix" ? "rejected" : null;
    const note = String(form.get("note") ?? "").trim().slice(0, 1000);
    const prompt = String(form.get("prompt") ?? "").slice(0, 8000);
    if (!(file instanceof Blob) || !file.type.startsWith("image/")) return Response.json({ error: "Choose the picture Gemini made." }, { status: 400 });
    if (file.size > 4_000_000) return Response.json({ error: "That picture is too large." }, { status: 400 });
    if (!pose) return Response.json({ error: "Which pose is this?" }, { status: 400 });
    const gid = code ? await productId(code) : null;
    if (!gid) return Response.json({ error: "Unknown product." }, { status: 404 });
    const mime = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";

    const [row] = await db
      .insert(generations)
      .values({
        clientKey: `test-${crypto.randomUUID()}`,
        accountId: account.id,
        garmentId: gid,
        promptId: pose,
        promptVersion: "pose-test · Gemini app",
        promptText: prompt || "(prompt not sent)",
        look: { modelType: "woman", age: "", background: "", quality: "standard" },
        provider: PROVIDER,
        model: "Nano Banana (Gemini app)",
        status: "running",
        costPaise: 0,
        ratePaisePerUsd: 0,
        creditsPaise: 0,
        verdict,
        note,
      })
      .returning({ id: generations.id });
    const key = await saveRender(gid, row!.id, new Uint8Array(await file.arrayBuffer()), mime, `${code}-${pose.replace(/[^A-Za-z0-9]+/g, "-")}.${mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1]}`);
    await db.update(generations).set({ status: "done", imageKey: key, imageMime: mime, finishedAt: new Date() }).where(eq(generations.id, row!.id));
    return Response.json({ ok: true, id: row!.id });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not save the result." }, { status: 500 });
  }
}
