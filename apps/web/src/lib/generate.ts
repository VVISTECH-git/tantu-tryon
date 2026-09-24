import { GEMINI_MODELS, GeminiError, generateImage } from "@tantu/engine";
import { eq } from "drizzle-orm";
import { db, generations, type Garment, type Generation, type GenerationLook } from "@/db";
import { TEMPLATES, composePrompt, defaultRules, type ModelType, type BackgroundId, type Selections } from "@/content/promptTemplates";
import { attachmentsFor, sheetFor, wordsFor } from "@/lib/garments";
import { finishGeneration, imageSizeFor, reserveGeneration, type ReserveResult } from "@/lib/spend";
import { renderUrl, saveRender } from "@/lib/storage";

/**
 * One image, start to finish.
 *
 * Compose the frozen prompt exactly as the Studio does, reserve the money,
 * call Gemini once, put the picture somewhere it can be served from, close
 * the row. The frozen wording is not touched here: `composePrompt` is the
 * same function the Studio's Copy button uses, fed from the garment row.
 */

export interface GenerateInput {
  accountId: string;
  garment: Garment;
  promptId: string;
  look: GenerationLook;
  clientKey: string;
  signal?: AbortSignal;
}

export interface GenerateOutput {
  id: string;
  status: Generation["status"];
  imageUrl: string | null;
  error: string | null;
  ms: number | null;
  model: string;
  promptText: string;
  costPaise: number;
  creditsPaise: number;
}

export type GenerateResult = { ok: true; generation: GenerateOutput } | { ok: false; status: number; message: string };

export function selectionsFor(look: GenerationLook): Selections {
  return {
    modelType: look.modelType as ModelType,
    modelSource: "generated",
    age: look.age,
    background: look.background as BackgroundId,
    attachMode: "sheet",
    rules: defaultRules(),
  };
}

export function modelFor(quality: GenerationLook["quality"]): string {
  return quality === "high"
    ? process.env.GEMINI_IMAGE_MODEL_HIGH || GEMINI_MODELS.high
    : process.env.GEMINI_IMAGE_MODEL || GEMINI_MODELS.standard;
}

export function toOutput(row: Generation): GenerateOutput {
  return {
    id: row.id,
    status: row.status,
    imageUrl: row.imageKey ? renderUrl(row.imageKey) : null,
    error: row.error,
    ms: row.ms,
    model: row.model,
    promptText: row.promptText,
    costPaise: row.costPaise,
    creditsPaise: row.creditsPaise,
  };
}

export async function runGeneration(input: GenerateInput): Promise<GenerateResult> {
  const template = TEMPLATES.find((t) => t.id === input.promptId);
  if (!template || !template.live) {
    return { ok: false, status: 400, message: `Prompt ${input.promptId} is not available.` };
  }

  const prompt = composePrompt(template, wordsFor(input.garment), selectionsFor(input.look), attachmentsFor(input.garment));
  const model = modelFor(input.look.quality);

  // The sheet first: building it costs nothing, and a garment whose
  // photographs cannot be fetched should fail before any money moves.
  let sheet: { data: string };
  try {
    sheet = await sheetFor(input.garment);
  } catch (error) {
    return { ok: false, status: 502, message: error instanceof Error ? error.message : "Could not build the sheet." };
  }

  const reserved: ReserveResult = await reserveGeneration({
    accountId: input.accountId,
    garmentId: input.garment.id,
    clientKey: input.clientKey,
    promptId: template.id,
    promptVersion: template.frozen ? `v${template.frozen.version}` : "draft",
    promptText: prompt,
    look: input.look,
    model,
  });
  if (!reserved.ok) return { ok: false, status: reserved.status, message: reserved.message };

  if (reserved.existing) {
    const [row] = await db.select().from(generations).where(eq(generations.id, reserved.id)).limit(1);
    return { ok: true, generation: toOutput(row!) };
  }

  try {
    const image = await generateImage({
      prompt,
      images: [{ data: sheet.data, mime: "image/png" }],
      model,
      aspectRatio: "3:4",
      imageSize: imageSizeFor(input.look.quality),
      signal: input.signal,
    });
    const stem = input.garment.productCode ?? input.garment.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40);
    const key = await saveRender(
      input.garment.id,
      reserved.id,
      Buffer.from(image.data, "base64"),
      image.mime,
      `${stem}-${template.id}-${reserved.id.slice(0, 6)}.${image.mime.includes("jpeg") ? "jpg" : "png"}`,
    );
    await finishGeneration(reserved.id, { ok: true, imageKey: key, imageMime: image.mime, ms: image.ms });
  } catch (error) {
    const gemini = error instanceof GeminiError ? error : null;
    await finishGeneration(reserved.id, {
      ok: false,
      status: gemini?.kind === "refused" ? "refused" : "failed",
      error: error instanceof Error ? error.message : String(error),
      billed: gemini ? gemini.billed : false,
    });
  }

  const [row] = await db.select().from(generations).where(eq(generations.id, reserved.id)).limit(1);
  return { ok: true, generation: toOutput(row!) };
}
