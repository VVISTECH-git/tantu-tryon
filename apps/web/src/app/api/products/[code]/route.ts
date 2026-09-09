export const runtime = "nodejs";

/**
 * A merchant's product, fetched from SLK by the code on its label.
 *
 * Proxied rather than called from the browser, for one reason: the credential.
 * SLK's endpoint is secret-gated, and a secret that reaches the browser is not
 * a secret. This route holds it and returns only the product.
 *
 * It is also the seam where SLK's shape becomes Tantu's. SLK speaks of
 * consignments, colourways and slots; Tantu only wants a garment and its four
 * parts, named the way its own recipe names them.
 */

interface SlkImage {
  slot: string | null;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

interface SlkProduct {
  productCode: string;
  title: string;
  description: string | null;
  design: {
    code: string;
    name: string;
    colour: string | null;
    productType: string | null;
    motif: string | null;
    motifCategory: string | null;
  };
  qty: number;
  images: SlkImage[];
}

/**
 * SLK's photograph slots, in Tantu's vocabulary.
 *
 * They already agree — both call them Body, Pallu, Border and Blouse, because
 * both are describing the same saree. Mapped explicitly anyway so that a slot
 * renamed on one side shows up as an unmapped extra rather than silently
 * arriving in the wrong place on the other.
 */
const SLOT_MAP: Record<string, string> = {
  body: "body",
  pallu: "pallu",
  border: "border",
  blouse: "blouse",
  "blouse piece": "blouse",
  "full drape": "full-drape",
  "full saree": "full-drape",
  weave: "weave",
  "weave detail": "weave",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const base = process.env.SLK_API_BASE;
  const secret = process.env.SLK_READ_SECRET;

  if (!base || !secret) {
    return Response.json(
      { error: "Product lookup is not configured." },
      { status: 503 },
    );
  }

  const { code } = await params;
  if (!/^\d{1,12}$/.test(code)) {
    return Response.json({ error: "That is not an SLK product code." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/products/${code}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Could not reach SLK." }, { status: 502 });
  }

  if (response.status === 404) {
    return Response.json({ error: `No product carries the code ${code}.` }, { status: 404 });
  }
  if (!response.ok) {
    // The upstream message may name the secret or the query; say less.
    return Response.json(
      { error: `SLK refused the lookup (${response.status}).` },
      { status: 502 },
    );
  }

  const product = (await response.json()) as SlkProduct;

  const parts = product.images.map((image) => ({
    slot: SLOT_MAP[(image.slot ?? "").trim().toLowerCase()] ?? null,
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
      missing: ["body", "pallu", "border", "blouse"].filter(
        (needed) => !parts.some((p) => p.slot === needed),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
