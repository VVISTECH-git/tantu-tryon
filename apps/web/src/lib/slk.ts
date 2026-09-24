/**
 * SLK's product API, in one place.
 *
 * Four routes each fetched the product themselves and each normalised the
 * photograph slot names its own way — one through a table, three by
 * hyphenating — so "Blouse piece" was a blouse on the Studio page and a 404
 * on the download. One fetch, one table, used everywhere.
 */

export interface SlkImage {
  slot: string | null;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface SlkProduct {
  productCode: string;
  title: string;
  description: string | null;
  design: { code: string; name: string } & Record<string, string | null>;
  qty: number;
  images: SlkImage[];
}

/** SLK's slot labels, in Tantu's vocabulary. Unmapped labels come back null. */
const SLOT_MAP: Record<string, string> = {
  body: "body",
  pallu: "pallu",
  border: "border",
  blouse: "blouse",
  "blouse piece": "blouse",
  "full drape": "full-drape",
  "full saree": "full-drape",
  "full-drape": "full-drape",
  weave: "weave",
  "weave detail": "weave",
};

export function normaliseSlot(label: string | null | undefined): string | null {
  return SLOT_MAP[(label ?? "").trim().toLowerCase()] ?? null;
}

export const PRODUCT_CODE = /^\d{1,12}$/;

export type SlkLookup =
  | { ok: true; product: SlkProduct }
  | { ok: false; status: 400 | 404 | 502 | 503; message: string };

export async function fetchProduct(code: string): Promise<SlkLookup> {
  const base = process.env.SLK_API_BASE;
  const secret = process.env.SLK_READ_SECRET;
  if (!base || !secret) return { ok: false, status: 503, message: "Product lookup is not configured." };
  if (!PRODUCT_CODE.test(code)) return { ok: false, status: 400, message: "That is not an SLK product code." };

  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/products/${code}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, message: "Could not reach SLK." };
  }
  if (response.status === 404) return { ok: false, status: 404, message: `No product carries the code ${code}.` };
  if (!response.ok) return { ok: false, status: 502, message: `SLK refused the lookup (${response.status}).` };
  return { ok: true, product: (await response.json()) as SlkProduct };
}

/** The product's photographs by Tantu slot; a later duplicate of a slot is ignored. */
export function partsBySlot(product: SlkProduct): Map<string, SlkImage> {
  const out = new Map<string, SlkImage>();
  for (const image of product.images) {
    const slot = normaliseSlot(image.slot);
    if (slot && !out.has(slot)) out.set(slot, image);
  }
  return out;
}

/** Fetch a photograph's bytes as base64, for the sheet builder. */
export async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch a photograph (${res.status}).`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}
