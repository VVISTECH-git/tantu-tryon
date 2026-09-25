import { buildContactSheet } from "@/lib/contactSheet";
import { describeSheet } from "@/lib/describe";
import { QUERY_KEY, parseRotations } from "@/lib/rotation";
import { requireRole, unauthorised } from "@/lib/session";
import { fetchBase64, fetchProduct, partsBySlot } from "@/lib/slk";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The Studio bench's describe button: the saree in words, from its
 * photographs, by product code. Behind the session now — it is the one paid
 * call the bench makes.
 */
const ORDER = ["body", "pallu", "border", "blouse"] as const;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await requireRole("admin", "studio");
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Sign in to do that." }, { status: 401 });
  }

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

  const sheet = await buildContactSheet(parts, { cell: 800 });
  const result = await describeSheet(sheet.data);
  if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
  return Response.json({ words: result.words, model: result.model, reader: result.reader }, { headers: { "Cache-Control": "no-store" } });
}
