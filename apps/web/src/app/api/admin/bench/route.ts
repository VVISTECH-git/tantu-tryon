import { randomUUID } from "node:crypto";
import type { DescribedGarment } from "@/content/garmentWords";
import { defaultAge, modelTypeFor } from "@/content/promptTemplates";
import type { GenerationLook } from "@/db";
import { createGarmentFromSlk, latestGarmentForCode, updateGarment } from "@/lib/garments";
import { runGeneration } from "@/lib/generate";
import { requirePlatform, unauthorised } from "@/lib/session";
import { balancePaise, grantCredits, CREDIT_PAISE } from "@/lib/spend";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Phase 0: does the frozen prompt survive the API?
 *
 * Takes an SLK code, makes (or reuses) its garment row, runs one frozen
 * prompt through the real path — sheet, reservation, Gemini, storage, ledger
 * — at one or both qualities, and hands back the images. It is the same code
 * the wizard will call; nothing here is a shortcut, which is the point.
 *
 * The house account is topped up if it cannot afford the run. Every rupee
 * still lands in the ledger and counts against the day's cap.
 */

interface Body {
  code: string;
  promptId?: string;
  quality?: "standard" | "high" | "both";
  words?: DescribedGarment;
  modelType?: string;
  age?: string;
  background?: string;
}

export async function POST(request: Request) {
  let account;
  try {
    account = await requirePlatform();
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Sign in to do that." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!body.code) return Response.json({ error: "Which product code?" }, { status: 400 });

  let garment = await latestGarmentForCode(account.id, body.code);
  if (!garment) {
    const made = await createGarmentFromSlk(account.id, body.code);
    if (!made.ok) return Response.json({ error: made.message }, { status: made.status });
    garment = made.garment;
  }
  if (body.words && Object.keys(body.words).length) {
    garment = await updateGarment(garment.id, { words: { ...garment.words, ...(body.words as Record<string, string>) } });
  }

  const qualities: GenerationLook["quality"][] =
    body.quality === "both" ? ["standard", "high"] : [body.quality ?? "standard"];
  const modelType = body.modelType ?? modelTypeFor(garment.design?.audienceType);

  const needed = qualities.reduce((sum, q) => sum + CREDIT_PAISE[q], 0);
  const balance = await balancePaise(account.id);
  if (balance < needed) {
    await grantCredits(account.id, needed - balance + 100_00, "bench top-up");
  }

  const runs = [];
  for (const quality of qualities) {
    const look: GenerationLook = {
      modelType,
      age: body.age ?? defaultAge(modelType as Parameters<typeof defaultAge>[0]),
      background: body.background ?? "courtyard",
      quality,
    };
    const result = await runGeneration({
      accountId: account.id,
      garment,
      promptId: body.promptId ?? "P1",
      look,
      clientKey: randomUUID(),
      signal: request.signal,
    });
    runs.push(result.ok ? result.generation : { error: result.message, status: result.status, quality });
  }

  return Response.json(
    { garmentId: garment.id, code: garment.productCode, title: garment.title, runs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
