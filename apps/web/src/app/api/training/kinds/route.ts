import { canReviewLabels } from "@/lib/partLabels";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { PHOTO_KINDS, TRAINING_SHOPS, readJson, writeJson, type PhotoKind } from "@/lib/trainingStore";

export const runtime = "nodejs";

/** Correct what one training photo is (full / fabric / poster); written back to its kinds.json in the bucket. */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!canReviewLabels(account)) throw new Forbidden();
    const { shop, id, file, kind } = (await request.json().catch(() => ({}))) as { shop?: string; id?: string; file?: string; kind?: string };
    if (!TRAINING_SHOPS.includes(shop as (typeof TRAINING_SHOPS)[number]) || !/^\d+$/.test(id ?? "") || !/^\d\d\.\w+$/.test(file ?? "")) {
      return Response.json({ error: "Which photo?" }, { status: 400 });
    }
    if (!PHOTO_KINDS.includes(kind as PhotoKind)) return Response.json({ error: "Choose full, fabric or poster." }, { status: 400 });
    const key = `${shop}/${id}/kinds.json`;
    const kinds = (await readJson<Record<string, PhotoKind>>(key)) ?? {};
    kinds[file!] = kind as PhotoKind;
    await writeJson(key, kinds);
    return Response.json({ ok: true, kinds });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not save." }, { status: 500 });
  }
}
