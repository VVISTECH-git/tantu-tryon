import { buildContactSheet } from "@/lib/contactSheet";
import { QUERY_KEY, parseRotations } from "@/lib/rotation";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The four photographs as one labelled image.
 *
 * A chat model is not shown attachment filenames, and attachment order is
 * only as reliable as the person attaching. So "which image is the border"
 * cannot be answered by naming files or numbering them. It can be answered by
 * printing BORDER above the photograph: the label is in the pixels, and the
 * model reads it the way it reads the fabric.
 *
 * Built on request from the originals in R2, at a panel size that keeps most
 * of their detail — this sheet is the only thing the model will get.
 */

const ORDER = ["body", "pallu", "border", "blouse"] as const;

interface Part {
  slot: string | null;
  url: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const base = process.env.SLK_API_BASE;
  const secret = process.env.SLK_READ_SECRET;
  if (!base || !secret) {
    return Response.json({ error: "Product lookup is not configured." }, { status: 503 });
  }

  const { code } = await params;
  if (!/^\d{1,12}$/.test(code)) {
    return Response.json({ error: "That is not an SLK product code." }, { status: 400 });
  }

  let images: Part[];
  try {
    const lookup = await fetch(`${base}/api/v1/products/${code}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!lookup.ok) {
      return Response.json({ error: `SLK refused the lookup (${lookup.status}).` }, { status: 502 });
    }
    images = ((await lookup.json()) as { images?: Part[] }).images ?? [];
  } catch {
    return Response.json({ error: "Could not reach SLK." }, { status: 502 });
  }

  const bySlot = new Map(
    images.map((i) => [(i.slot ?? "").trim().toLowerCase().replace(/\s+/g, "-"), i.url]),
  );
  const present = ORDER.filter((slot) => bySlot.has(slot));
  if (present.length === 0) {
    return Response.json({ error: `${code} has no photographs.` }, { status: 404 });
  }

  // Orientation corrections chosen in the Studio, so the sheet shows each
  // part the way the person sees it there.
  const rotations = parseRotations(new URL(request.url).searchParams.get(QUERY_KEY));

  const parts = await Promise.all(
    present.map(async (slot) => {
      const file = await fetch(bySlot.get(slot)!, { cache: "no-store" });
      if (!file.ok) throw new Error(`Could not fetch the ${slot} photograph.`);
      return {
        key: slot,
        label: slot.toUpperCase(),
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        rotate: rotations[slot] ?? 0,
      };
    }),
  ).catch((error: Error) => error);

  if (parts instanceof Error) {
    return Response.json({ error: parts.message }, { status: 502 });
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
