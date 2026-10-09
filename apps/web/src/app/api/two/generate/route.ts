import { and, eq } from "drizzle-orm";
import { db, generations } from "@/db";
import { getGarment, updateGarment } from "@/lib/garments";
import { readAsset } from "@/lib/storage";
import { runGarmentGemini, withGarmentSpec, withSareeSpec } from "@/lib/generate";
import { requireAccount, unauthorised } from "@/lib/session";
import { cleanChoices, twoPrompt, twoRatio } from "@/lib/twoPrompt";

export const runtime = "nodejs";
export const maxDuration = 300;

const SIZES = new Set(["1K", "2K", "4K"]);
const MODEL_TYPE: Record<string, string> = { female: "woman", male: "man", girl: "girl", boy: "boy" };

/**
 * One photo for a tantu-two shoot (9 Oct): the product's photos, the seller's choices from
 * tantu-two's screens (garment, details, model, pose, background, shape, size), made on Gemini.
 * The prompt is built here from those choices; nothing the page sends is used as a prompt.
 *
 *   { garmentId, clientKey, quality: "1K"|"2K"|"4K", choices }  → { generation }
 */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = (await request.json().catch(() => ({}))) as { garmentId?: string; clientKey?: string; quality?: string; choices?: unknown; anchorId?: string };
    if (!body.garmentId || !body.clientKey || !/^[A-Za-z0-9:_-]{8,80}$/.test(body.clientKey)) {
      return Response.json({ error: "garmentId and clientKey are required." }, { status: 400 });
    }
    const choices = cleanChoices(body.choices);
    if (!choices) return Response.json({ error: "Unknown garment." }, { status: 400 });
    // 9 Oct, user: "no matter what I choose, let us have the 6-rupee photo for now" — every tantu-two
    // photo is the everyday 1K model until the user says otherwise; the page's choice is kept for later.
    const asked = SIZES.has(body.quality ?? "") ? (body.quality as "1K" | "2K" | "4K") : "2K";
    void asked;
    const size = "1K" as const;

    let found = await getGarment(body.garmentId, account.id);
    if (!found) return Response.json({ error: "No such product." }, { status: 404 });
    // Which tantu-two tile it was shot as, for "My photos" and "More poses" (9 Oct).
    if ((found.words as Record<string, string> | null)?.twoGarment !== choices.garment) {
      found = await updateGarment(found.id, { words: { ...((found.words ?? {}) as Record<string, string>), twoGarment: choices.garment } });
    }
    const garment = found.garmentType === "saree" ? await withSareeSpec(found) : await withGarmentSpec(found);

    // The shoot's first picture (9 Oct, Drapify's anchor): every later pose keeps its model and outfit.
    let anchor: { data: string; mime: string } | null = null;
    if (body.anchorId) {
      const [a] = await db
        .select({ key: generations.imageKey, mime: generations.imageMime })
        .from(generations)
        .where(and(eq(generations.id, body.anchorId), eq(generations.accountId, account.id), eq(generations.garmentId, garment.id), eq(generations.status, "done")))
        .limit(1);
      if (a?.key) anchor = { data: Buffer.from(await readAsset(a.key)).toString("base64"), mime: a.mime || "image/png" };
    }

    const result = await runGarmentGemini({
      accountId: account.id,
      garment,
      promptId: choices.pose.slice(0, 40),
      look: { modelType: MODEL_TYPE[choices.gender.toLowerCase()] ?? "woman", age: choices.age || "20s", background: choices.background.slice(0, 40), quality: size === "1K" ? "standard" : "high" },
      clientKey: body.clientKey,
      signal: request.signal,
      promptOverride: twoPrompt(garment, choices, Boolean(anchor)),
      extraImages: anchor ? [anchor] : undefined,
      free: account.platformAdmin,
      aspectRatio: twoRatio(choices),
      size,
    });
    if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
    // The page never needs the prompt.
    const { promptText: _prompt, ...generation } = result.generation;
    void _prompt;
    return Response.json({ generation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not make the photo." }, { status: 500 });
  }
}
