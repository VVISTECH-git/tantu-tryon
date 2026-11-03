import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, garments } from "@/db";
import { captureShotsFor } from "@/content/shots";
import { buildContactSheet, type SheetPart } from "@/lib/contactSheet";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One product's photos as one labelled image, by the code on its tag (3 Nov),
 * for the aartisanz portal to copy into Gemini. Open like /api/shop/photos:
 * it answers only for a code the caller already has. Tag photo left out.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).trim().toUpperCase();
  const [g] = await db
    .select()
    .from(garments)
    .where(and(eq(sql`upper(${garments.productCode})`, code), isNull(garments.deletedAt)))
    .orderBy(desc(garments.updatedAt))
    .limit(1);
  if (!g) return Response.json({ error: "Tantu has no product with this code." }, { status: 404 });

  const order = captureShotsFor(g.garmentType).map((s) => s.slot);
  const rank = (slot: string) => (order.includes(slot) ? order.indexOf(slot) : order.length);
  const parts = g.parts.filter((p) => p.slot !== "tag").sort((a, b) => rank(a.slot) - rank(b.slot));
  if (!parts.length) return Response.json({ error: "No photos yet, only the tag." }, { status: 404 });

  try {
    const sheetParts: SheetPart[] = await Promise.all(
      parts.map(async (p) => {
        const bytes = p.key ? await getObject(p.key) : new Uint8Array(await (await fetch(p.url)).arrayBuffer());
        return { key: p.slot, label: p.slot.replace(/_/g, " "), data: Buffer.from(bytes).toString("base64"), rotate: p.rotate };
      }),
    );
    const sheet = await buildContactSheet(sheetParts, { cell: 900, format: "jpeg" });
    return new Response(Buffer.from(sheet.data, "base64"), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("shop combined", error);
    return Response.json({ error: "Could not make the image." }, { status: 500 });
  }
}
