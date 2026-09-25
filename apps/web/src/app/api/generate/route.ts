import type { GenerationLook } from "@/db";
import { BACKGROUNDS, MODEL_TYPES, TEMPLATES } from "@/content/promptTemplates";
import { getGarment } from "@/lib/garments";
import { runGeneration } from "@/lib/generate";
import { requireRole, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * One image. The browser calls this once per pose it wants, with a client
 * key it made up for the attempt; the same key sent again returns the same
 * row instead of spending again.
 */
interface Body {
  garmentId?: string;
  promptId?: string;
  look?: Partial<GenerationLook>;
  clientKey?: string;
}

export async function POST(request: Request) {
  try {
    const account = await requireRole("owner", "studio");
    const body = (await request.json().catch(() => ({}))) as Body;

    if (!body.garmentId || !body.promptId || !body.clientKey || !body.look) {
      return Response.json({ error: "garmentId, promptId, look and clientKey are required." }, { status: 400 });
    }
    if (!/^[A-Za-z0-9:_-]{8,80}$/.test(body.clientKey)) {
      return Response.json({ error: "clientKey must be 8–80 plain characters." }, { status: 400 });
    }
    if (!TEMPLATES.some((t) => t.id === body.promptId && t.live)) {
      return Response.json({ error: `Prompt ${body.promptId} is not available.` }, { status: 400 });
    }
    const look = body.look;
    if (!MODEL_TYPES.some((m) => m.id === look.modelType)) {
      return Response.json({ error: "Unknown model type." }, { status: 400 });
    }
    if (!BACKGROUNDS.some((b) => b.id === look.background)) {
      return Response.json({ error: "Unknown background." }, { status: 400 });
    }
    if (look.quality !== "standard" && look.quality !== "high") {
      return Response.json({ error: "Quality must be standard or high." }, { status: 400 });
    }
    if (typeof look.age !== "string" || look.age.length > 40) {
      return Response.json({ error: "Age is not right." }, { status: 400 });
    }

    const garment = await getGarment(body.garmentId, account.id);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });

    const result = await runGeneration({
      accountId: account.id,
      garment,
      promptId: body.promptId,
      look: { modelType: look.modelType!, age: look.age, background: look.background!, quality: look.quality },
      clientKey: body.clientKey,
      signal: request.signal,
    });
    if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
    return Response.json({ generation: result.generation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "The render failed." }, { status: 500 });
  }
}
