import { describeSheet } from "@/lib/describe";
import { getGarment, publicGarment, sheetFor, updateGarment, wordsFor } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Read the garment's sheet into words and keep them on the garment.
 *
 * What a person already typed wins over what the reader says: the reader
 * fills gaps, it does not overrule corrections.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    const { id } = await params;
    const garment = await getGarment(id, account.id);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });

    const sheet = await sheetFor(garment);
    const result = await describeSheet(sheet.data);
    if (!result.ok) return Response.json({ error: result.message }, { status: result.status });

    const updated = await updateGarment(id, { words: { ...(result.words as Record<string, string>), ...garment.words } });
    return Response.json(
      { garment: publicGarment(updated), words: wordsFor(updated), described: result.words, model: result.model },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not describe." }, { status: 500 });
  }
}
