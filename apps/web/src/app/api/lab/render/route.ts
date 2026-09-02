import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildPoseOnly, buildRecipe, recipeForPose, runRecipe, toRawBase64 } from "@tantu/engine";
import type { ModelBrief, ProviderId, RecipeAssets, RecipeBuild, RecipeImage } from "@tantu/engine";
import { poseSpec } from "@/registry/poses";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The lab's generation endpoint.
 *
 * Deliberately separate from /api/render, which is the customer path. Recipes
 * are unproven; keeping them on their own route means running one twenty times
 * cannot destabilise the Studio, and the two can be compared side by side.
 */

interface Body {
  poseId: string;
  model: ModelBrief;
  quality?: "standard" | "high";
  assets: Partial<Record<keyof RecipeAssets, string>>;
  /**
   * Build the prompt and stop, without calling the provider.
   *
   * The recipe is the thing being iterated on, and reading what it produced is
   * how you improve it. Charging for that would make the obvious workflow the
   * expensive one.
   */
  dryRun?: boolean;
  /**
   * Send the pose reference, or leave it out.
   *
   * The bench control for the one question that cannot be answered by reading:
   * whether supplying a photograph of a person is itself what a refusal is
   * about. Two runs, one variable.
   */
  useMasterReference?: boolean;
  /** Which pose reference to send: the photo, the flat silhouette, or none. */
  poseReference?: "master" | "silhouette" | "none";
  /**
   * Diagnostic: send the stance and nothing else, no garment photographs.
   *
   * Answers whether four dense textile references are crowding out the pose
   * instruction, or the model will not produce this stance at all. The garment
   * in the output is meaningless and the run is labelled as such.
   */
  poseOnly?: boolean;
  /** Which engine runs it. Defaults to Gemini. */
  provider?: ProviderId;
}

const REQUIRED: (keyof RecipeAssets)[] = ["body", "pallu", "border", "blouse"];

/** The approved master reference, read off disk and inlined for the provider. */
async function loadMasterReference(url: string): Promise<RecipeImage | undefined> {
  try {
    const file = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    const bytes = await readFile(file);
    return { data: bytes.toString("base64"), mime: "image/png" };
  } catch {
    // Recorded on the pose but not readable. The recipe warns; it does not fail.
    return undefined;
  }
}

/**
 * Which image steers the pose, if any.
 *
 * Gemini declines the photographic master reference outright, so the flat
 * silhouette is a live alternative rather than a curiosity — it carries the
 * same geometry with none of the person.
 */
async function resolvePoseReference(
  pose: NonNullable<ReturnType<typeof poseSpec>>,
  body: Body,
): Promise<Pick<RecipeAssets, "masterReference" | "poseReferenceKind">> {
  const choice =
    body.poseReference ?? (body.useMasterReference === false ? "none" : "master");
  if (choice === "none") return {};

  const url =
    choice === "silhouette" ? pose.assets.silhouette : pose.assets.masterReference;
  if (!url) return {};

  const image = await loadMasterReference(url);
  if (!image) return {};
  return { masterReference: image, poseReferenceKind: choice === "silhouette" ? "silhouette" : "photo" };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const pose = poseSpec(body.poseId);
  if (!pose) {
    return Response.json({ error: `No pose ${body.poseId} in the registry.` }, { status: 404 });
  }

  const recipe = recipeForPose(pose.id);
  if (!recipe) {
    return Response.json(
      { error: `${pose.id} has no generation recipe.` },
      { status: 400 },
    );
  }

  const poseRef = await resolvePoseReference(pose, body);

  if (body.poseOnly) {
    const built = buildPoseOnly({ model: body.model ?? {}, ...poseRef });
    return finish(built, body, req);
  }

  const missing = REQUIRED.filter((k) => !body.assets?.[k]);
  if (missing.length) {
    return Response.json(
      { error: `Missing ${missing.join(", ")}.` },
      { status: 400 },
    );
  }

  const image = (value?: string): RecipeImage | undefined =>
    value ? { data: toRawBase64(value) } : undefined;

  const assets: RecipeAssets = {
    body: image(body.assets.body)!,
    pallu: image(body.assets.pallu)!,
    border: image(body.assets.border)!,
    blouse: image(body.assets.blouse)!,
    fullDrape: image(body.assets.fullDrape),
    weave: image(body.assets.weave),
    ...poseRef,
  };

  const built = buildRecipe(pose.id, { model: body.model ?? {}, assets });
  return finish(built, body, req);
}

/** Dry run, or run it. Shared by the full recipe and the pose-only diagnostic. */
async function finish(built: RecipeBuild, body: Body, req: Request) {
  if (body.dryRun) {
    return Response.json(
      {
        dryRun: true,
        recipeId: built.recipeId,
        poseId: built.poseId,
        prompt: built.prompt,
        imageCount: built.references.length,
        warnings: built.warnings,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // The browser dropping the connection has to reach the provider, or Stop
  // means "stop watching the money leave".
  const aborter = new AbortController();
  req.signal.addEventListener("abort", () => aborter.abort(), { once: true });

  try {
    const result = await runRecipe(built, {
      provider: body.provider,
      quality: body.quality,
      signal: aborter.signal,
    });
    return Response.json(
      {
        recipeId: result.recipeId,
        poseId: result.poseId,
        provider: result.provider,
        model: result.model,
        ms: result.ms,
        image: `data:${result.mime};base64,${result.data}`,
        prompt: result.prompt,
        warnings: built.warnings,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "The run failed.",
        recipeId: built.recipeId,
        prompt: built.prompt,
        warnings: built.warnings,
      },
      { status: 502 },
    );
  }
}
