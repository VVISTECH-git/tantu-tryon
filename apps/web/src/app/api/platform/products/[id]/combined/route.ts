import { and, eq, isNull } from "drizzle-orm";
import { db, garments } from "@/db";
import { captureShotsFor } from "@/content/shots";
import { buildContactSheet, type SheetPart } from "@/lib/contactSheet";
import { requirePlatform, unauthorised } from "@/lib/session";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One product's photos joined into one labelled image (3 Nov), to paste into
 * Gemini by hand. The photographer's order; the tag photo left out.
 * Platform admin only.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatform();
    const { id } = await params;
    const [g] = await db.select().from(garments).where(and(eq(garments.id, id), isNull(garments.deletedAt))).limit(1);
    if (!g) return Response.json({ error: "No such product." }, { status: 404 });

    const order = captureShotsFor(g.garmentType).map((s) => s.slot);
    const rank = (slot: string) => (order.includes(slot) ? order.indexOf(slot) : order.length);
    const parts = g.parts.filter((p) => p.slot !== "tag").sort((a, b) => rank(a.slot) - rank(b.slot));
    if (!parts.length) return Response.json({ error: "This product has no photos yet." }, { status: 404 });

    const sheetParts: SheetPart[] = await Promise.all(
      parts.map(async (p) => {
        const bytes = p.key ? await getObject(p.key) : new Uint8Array(await (await fetch(p.url)).arrayBuffer());
        return { key: p.slot, label: p.slot.replace(/_/g, " "), data: Buffer.from(bytes).toString("base64"), rotate: p.rotate };
      }),
    );
    const sheet = await buildContactSheet(sheetParts, { cell: 900, format: "jpeg" });
    const name = `${(g.productCode ?? "product").replace(/[^A-Za-z0-9-]/g, "_")}-combined.jpg`;
    return new Response(Buffer.from(sheet.data, "base64"), {
      headers: { "Content-Type": "image/jpeg", "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not make the image." }, { status: 500 });
  }
}
