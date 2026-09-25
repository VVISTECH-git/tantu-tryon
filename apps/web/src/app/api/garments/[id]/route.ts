import type { GarmentAnswers, GarmentPartRow } from "@/db";
import { PRODUCT_ID_PATTERN, blouseAnswer, getGarment, productIdTaken, publicGarment, updateGarment, wordsFor } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const account = await requireAccount();
    const { id } = await params;
    const garment = await getGarment(id, account.id);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });
    return Response.json({ garment: publicGarment(garment), words: wordsFor(garment) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not load the garment." }, { status: 500 });
  }
}

interface Patch {
  words?: Record<string, string>;
  answers?: GarmentAnswers;
  /** Quarter turns by slot. */
  rotations?: Record<string, 0 | 90 | 180 | 270>;
  /** Optional parts a merchant took back off. */
  removeSlots?: string[];
  /** A product ID for a record made before IDs were asked for. */
  productCode?: string;
}

/** Corrected words, the two questions, and orientation turns. Anything that changes the sheet drops the cached one. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const account = await requireAccount();
    const { id } = await params;
    const garment = await getGarment(id, account.id);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });

    const patch = (await request.json().catch(() => ({}))) as Patch;
    const next: Parameters<typeof updateGarment>[1] = {};

    if (patch.productCode !== undefined) {
      const code = String(patch.productCode).trim();
      if (!PRODUCT_ID_PATTERN.test(code)) {
        return Response.json({ error: "Enter the product ID: letters and numbers, up to 40 characters." }, { status: 400 });
      }
      if (await productIdTaken(account.id, code, garment.id)) {
        return Response.json({ error: `${code} already has its own record. Open it from Saved products.` }, { status: 409 });
      }
      next.productCode = code;
    }

    if (patch.words) {
      const words: Record<string, string> = {};
      for (const [key, value] of Object.entries(patch.words)) {
        if (typeof value === "string" && value.trim()) words[key] = value.trim().slice(0, 400);
      }
      next.words = words;
    }
    if (patch.answers) {
      // Only booleans, only known keys; the questions on the details screen.
      const allowed = ["blouseSameAsBody", "palluDistinct", "borders", "bordersIdentical"] as const;
      const answers: Record<string, boolean> = {};
      for (const key of allowed) {
        const v = (patch.answers as Record<string, unknown>)[key];
        if (typeof v === "boolean") answers[key] = v;
      }
      next.answers = answers as typeof garment.answers;
    }
    if (patch.rotations || patch.removeSlots) {
      const gone = new Set(patch.removeSlots ?? []);
      const parts: GarmentPartRow[] = garment.parts
        .filter((p) => !gone.has(p.slot))
        .map((p) => {
          const deg = patch.rotations?.[p.slot];
          return deg === 0 || deg === 90 || deg === 180 || deg === 270 ? { ...p, rotate: deg } : p;
        });
      next.parts = parts;
      if (patch.removeSlots?.length) next.answers = blouseAnswer(garment, parts);
    }

    const updated = await updateGarment(id, next);
    return Response.json({ garment: publicGarment(updated), words: wordsFor(updated) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not update the garment." }, { status: 500 });
  }
}
