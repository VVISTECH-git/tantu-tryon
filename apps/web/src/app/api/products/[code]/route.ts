import { fetchProduct, normaliseSlot } from "@/lib/slk";

export const runtime = "nodejs";

/**
 * A merchant's product, fetched from SLK by the code on its label.
 *
 * Proxied rather than called from the browser, for one reason: the credential.
 * SLK's endpoint is secret-gated, and a secret that reaches the browser is not
 * a secret. This route holds it and returns only the product.
 *
 * It is also the seam where SLK's shape becomes Tantu's: SLK speaks of
 * consignments, colourways and slots; Tantu only wants a garment and its
 * parts, named the way its own recipe names them (`lib/slk.ts`).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const lookup = await fetchProduct(code);
  if (!lookup.ok) return Response.json({ error: lookup.message }, { status: lookup.status, headers: CORS });

  const { product } = lookup;
  const parts = product.images.map((image) => ({
    slot: normaliseSlot(image.slot),
    label: image.slot ?? "Unlabelled",
    url: image.url,
    width: image.width,
    height: image.height,
    alt: image.alt,
  }));

  return Response.json(
    {
      code: product.productCode,
      title: product.title,
      description: product.description,
      design: product.design,
      parts,
      /** The four the recipe needs, and whether this product has them. */
      missing: ["body", "pallu", "border", "blouse"].filter((needed) => !parts.some((p) => p.slot === needed)),
    },
    { headers: CORS },
  );
}

/**
 * Readable from anywhere.
 *
 * What is behind the route is already public and read-only: a product's title
 * and the addresses of photographs that R2 serves openly. The credential that
 * reaches SLK stays on this side.
 */
const CORS = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
