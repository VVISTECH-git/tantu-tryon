import sharp from "sharp";
import { QUERY_KEY, parseRotations } from "@/lib/rotation";

export const runtime = "nodejs";

/**
 * One photograph, as a download.
 *
 * With `?r=border:90` the photograph is turned a quarter before it goes out.
 * A quarter turn moves pixels without resampling them, and the result is
 * written as PNG, which is lossless — so a turned photograph carries every
 * pixel of the original, only upright. Untouched photographs stream through
 * exactly as stored.
 *
 * The link on its own is not enough: the image tools these prompts are written
 * for cannot fetch a URL — they want a file attached. Handing over an address
 * therefore leaves the actual work undone.
 *
 * Proxied rather than linked directly at R2 for two reasons. `download` on an
 * anchor is ignored cross-origin, so a bare R2 link navigates instead of
 * saving; and the file arrives named `cced55d9-4e96-…png`, which tells nobody
 * which part of which saree it is. Coming from this origin it saves, and it
 * saves as `300021-body.png`.
 */

const SLOTS = new Set(["body", "pallu", "border", "blouse", "full-drape", "weave"]);

interface Part {
  slot: string | null;
  url: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; slot: string }> },
) {
  const base = process.env.SLK_API_BASE;
  const secret = process.env.SLK_READ_SECRET;
  if (!base || !secret) {
    return Response.json({ error: "Product lookup is not configured." }, { status: 503 });
  }

  const { code, slot } = await params;
  if (!/^\d{1,12}$/.test(code)) {
    return Response.json({ error: "That is not an SLK product code." }, { status: 400 });
  }
  if (!SLOTS.has(slot)) {
    return Response.json({ error: `Unknown part: ${slot}.` }, { status: 400 });
  }

  // Resolved server-side rather than taking a URL from the caller: a proxy that
  // fetches whatever address it is handed is an open relay.
  let product: { images?: Part[] };
  try {
    const lookup = await fetch(`${base}/api/v1/products/${code}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!lookup.ok) {
      return Response.json({ error: `SLK refused the lookup (${lookup.status}).` }, { status: 502 });
    }
    product = (await lookup.json()) as { images?: Part[] };
  } catch {
    return Response.json({ error: "Could not reach SLK." }, { status: 502 });
  }

  const match = (product.images ?? []).find(
    (image) => (image.slot ?? "").trim().toLowerCase().replace(/\s+/g, "-") === slot,
  );
  if (!match) {
    return Response.json({ error: `${code} has no ${slot} photograph.` }, { status: 404 });
  }

  const file = await fetch(match.url, { cache: "no-store" });
  if (!file.ok || !file.body) {
    return Response.json({ error: "The photograph could not be fetched." }, { status: 502 });
  }

  const rotation = parseRotations(new URL(request.url).searchParams.get(QUERY_KEY))[slot] ?? 0;
  if (rotation !== 0) {
    const turned = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate(rotation)
      .png()
      .toBuffer();
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

  return new Response(file.body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${code}-${slot}.${extension}"`,
      "Cache-Control": "no-store",
    },
  });
}
