import { canReviewLabels, cleanRegions } from "@/lib/partLabels";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { TRAINING_SHOPS, noteMarked, readJson, writeJson, type TrainingMarks } from "@/lib/trainingStore";

export const runtime = "nodejs";

/** Parts marked on one training photo (body, pallu, borders, blouse), saved to the product's marks.json. No parts = marks removed. */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!canReviewLabels(account)) throw new Forbidden();
    const body = (await request.json().catch(() => ({}))) as { shop?: string; id?: string; file?: string; regions?: unknown };
    if (!TRAINING_SHOPS.includes(body.shop as (typeof TRAINING_SHOPS)[number]) || !/^\d+$/.test(body.id ?? "") || !/^\d\d\.\w+$/.test(body.file ?? "")) {
      return Response.json({ error: "Which photo?" }, { status: 400 });
    }
    const regions = Array.isArray(body.regions) && body.regions.length === 0 ? [] : cleanRegions(body.regions);
    if (!regions) return Response.json({ error: "Each part needs a name and at least 3 points." }, { status: 400 });
    const key = `${body.shop}/${body.id}/marks.json`;
    const marks = (await readJson<Record<string, TrainingMarks>>(key)) ?? {};
    if (regions.length === 0) delete marks[body.file!];
    else marks[body.file!] = { regions, by: account.username ?? account.name, at: new Date().toISOString() };
    await writeJson(key, marks);
    await noteMarked(body.shop!, body.id!, Object.keys(marks).length);
    return Response.json({ ok: true });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not save." }, { status: 500 });
  }
}
