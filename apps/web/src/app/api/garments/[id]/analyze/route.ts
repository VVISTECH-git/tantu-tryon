import { describeSheet } from "@/lib/describe";
import { getGarment, isReady, missingSlots, publicGarment, sheetFor, updateGarment, wordsFor } from "@/lib/garments";
import { shotFor } from "@/content/shots";
import { requireRole, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "Analyzing your garment."
 *
 * Reads the photographs into words with a vision model. For the older
 * one-flat-photo path it also looks at the photograph itself for the things
 * that make a saree render badly: a landscape flat lay (pallu probably not
 * at the bottom) or only a close-up. Rod shots carry their own quality check
 * from upload, and those results are repeated here so the confirm screen
 * can show them. The words a person already typed are kept; the reader fills
 * the gaps.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireRole("owner", "studio");
    const { id } = await params;
    const garment = await getGarment(id, account.id);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });
    if (!isReady(garment)) {
      const missing = missingSlots(garment).map((slot) => shotFor(garment.garmentType, slot)?.label ?? slot);
      return Response.json({ error: `Add these photos first: ${missing.join(", ")}.` }, { status: 422 });
    }

    const warnings: { title: string; body: string }[] = [];
    for (const part of garment.parts) {
      if (!part.quality || part.quality.status !== "warn") continue;
      const label = shotFor(garment.garmentType, part.slot)?.label ?? part.slot;
      warnings.push({ title: `${label} photo could be better.`, body: part.quality.reasons.map((r) => r.message).join(" ") });
    }
    const flat = garment.parts.find((p) => p.slot === "saree");
    if (flat && flat.width && flat.height && flat.width > flat.height) {
      warnings.push({
        title: "Please review this saree photo.",
        body: "For best accuracy, please check that the saree is uploaded with the pallu panel at the bottom.",
      });
    }
    if (flat && flat.width && flat.height && flat.height / flat.width < 1.15) {
      warnings.push({
        title: "Some saree details are hidden in this photo.",
        body: "We can still create an image, but the pallu, borders, or pattern may not match perfectly. For the best saree results, use a vertical flat-lay with the pallu at the bottom.\n\nYou can upload another photo or tap Continue to move ahead.",
      });
    }

    let described: Record<string, string> = {};
    let model: string | null = null;
    let readerError: string | null = null;
    try {
      const sheet = await sheetFor(garment);
      const result = await describeSheet(sheet.data, sheet.mime);
      if (result.ok) {
        described = result.words as Record<string, string>;
        model = result.model;
      } else {
        readerError = result.message;
      }
    } catch (error) {
      readerError = error instanceof Error ? error.message : "Could not read the photographs.";
    }

    const updated = Object.keys(described).length
      ? await updateGarment(id, { words: { ...described, ...garment.words } })
      : garment;

    return Response.json(
      { garment: publicGarment(updated), words: wordsFor(updated), warnings, model, readerError, garmentType: updated.garmentType },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not analyze." }, { status: 500 });
  }
}
