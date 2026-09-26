import { generationRecords } from "@/lib/generationRecords";
import { requirePlatform, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * The input sheet, the exact prompt and the result of recent generations.
 * Platform admin only. `?product=UNCLE`, `?id=<generation>`, `?limit=20`;
 * `?format=text&id=...` returns just that prompt as a text download.
 */
export async function GET(request: Request) {
  try {
    await requirePlatform();
    const q = new URL(request.url).searchParams;
    const records = await generationRecords({
      productCode: q.get("product") ?? undefined,
      id: q.get("id") ?? undefined,
      limit: Number(q.get("limit") ?? 20),
    });
    if (q.get("format") === "text") {
      const r = records[0];
      if (!r) return Response.json({ error: "No such generation." }, { status: 404 });
      const name = `${r.productCode ?? "tantu"}-${r.promptId}-${r.promptVersion}-${r.id.slice(0, 6)}-prompt.txt`;
      return new Response(r.promptText, {
        headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
      });
    }
    return Response.json({ generations: records }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not read the generations." }, { status: 500 });
  }
}
