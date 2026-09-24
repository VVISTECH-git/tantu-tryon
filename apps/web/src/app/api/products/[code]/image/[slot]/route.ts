import sharp from "sharp";
import { QUERY_KEY, parseRotations } from "@/lib/rotation";
import { fetchProduct, partsBySlot } from "@/lib/slk";

export const runtime = "nodejs";

/**
 * One photograph, as a download, for the Studio bench.
 *
 * With `?r=border:90` the photograph is turned a quarter before it goes out,
 * losslessly. Proxied rather than linked at R2 so the anchor's `download`
 * works and the file arrives named `300021-body.png` rather than a UUID.
 */
const SLOTS = new Set(["body", "pallu", "border", "blouse", "full-drape", "weave"]);

export async function GET(request: Request, { params }: { params: Promise<{ code: string; slot: string }> }) {
  const { code, slot } = await params;
  if (!SLOTS.has(slot)) return Response.json({ error: `Unknown part: ${slot}.` }, { status: 400 });

  const lookup = await fetchProduct(code);
  if (!lookup.ok) return Response.json({ error: lookup.message }, { status: lookup.status });

  const match = partsBySlot(lookup.product).get(slot);
  if (!match) return Response.json({ error: `${code} has no ${slot} photograph.` }, { status: 404 });

  const file = await fetch(match.url, { cache: "no-store" });
  if (!file.ok) return Response.json({ error: "The photograph could not be fetched." }, { status: 502 });

  const rotation = parseRotations(new URL(request.url).searchParams.get(QUERY_KEY))[slot] ?? 0;
  const bytes = Buffer.from(await file.arrayBuffer());

  // A phone's portrait JPEG is often sideways pixels plus an orientation
  // tag. A browser obeys the tag; an image model may not.
  const tagged = ((await sharp(bytes).metadata()).orientation ?? 1) !== 1;
  if (rotation !== 0 || tagged) {
    const turned = await sharp(bytes).autoOrient().rotate(rotation).png().toBuffer();
    return new Response(turned, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${code}-${slot}.png"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const type = file.headers.get("content-type") ?? "image/png";
  const extension = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  return new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${code}-${slot}.${extension}"`,
      "Cache-Control": "no-store",
    },
  });
}
