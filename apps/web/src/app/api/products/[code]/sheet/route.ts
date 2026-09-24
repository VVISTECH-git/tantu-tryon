import { buildContactSheet } from "@/lib/contactSheet";
import { QUERY_KEY, parseRotations } from "@/lib/rotation";
import { fetchBase64, fetchProduct, partsBySlot } from "@/lib/slk";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The photographs as one labelled image, for the Studio bench.
 *
 * A chat model is not shown attachment filenames, and attachment order is
 * only as reliable as the person attaching. Printing BORDER above the
 * photograph puts the label in the pixels, where the model reads it the way
 * it reads the fabric.
 */
const ORDER = ["body", "pallu", "border", "blouse"] as const;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const lookup = await fetchProduct(code);
  if (!lookup.ok) return Response.json({ error: lookup.message }, { status: lookup.status });

  const bySlot = partsBySlot(lookup.product);
  const present = ORDER.filter((slot) => bySlot.has(slot));
  if (present.length === 0) return Response.json({ error: `${code} has no photographs.` }, { status: 404 });

  const rotations = parseRotations(new URL(request.url).searchParams.get(QUERY_KEY));
  let parts;
  try {
    parts = await Promise.all(
      present.map(async (slot) => ({
        key: slot,
        label: slot.toUpperCase(),
        data: await fetchBase64(bySlot.get(slot)!.url),
        rotate: rotations[slot] ?? 0,
      })),
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not fetch the photographs." }, { status: 502 });
  }

  const sheet = await buildContactSheet(parts, { cell: 1000 });
  return new Response(Buffer.from(sheet.data, "base64"), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${code}-sheet.png"`,
      "Cache-Control": "no-store",
    },
  });
}
