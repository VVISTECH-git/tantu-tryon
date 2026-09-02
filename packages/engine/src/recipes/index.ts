import { getProvider } from "../providers/index";
import type { ProviderId, RenderRequest } from "../types";
import { SAR_P15_RECIPE } from "./sar-p15";
import type { PoseRecipe, RecipeBuild, RecipeInput } from "./types";

export * from "./types";
export { SAR_P15_RECIPE };

/**
 * Recipes, by pose.
 *
 * One entry so far, deliberately. A second pose gets its own module rather than
 * a shared abstraction — the shape only becomes clear once three exist, and
 * generalising from one produces a universal prompt, which is the thing the
 * architecture rules out.
 */
const RECIPES: PoseRecipe[] = [SAR_P15_RECIPE];

const BY_POSE = new Map(RECIPES.map((r) => [r.poseId, r]));
const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

export function recipeForPose(poseId: string): PoseRecipe | undefined {
  return BY_POSE.get(poseId);
}

export function recipeById(id: string): PoseRecipe | undefined {
  return BY_ID.get(id);
}

export function buildRecipe(poseId: string, input: RecipeInput): RecipeBuild {
  const recipe = recipeForPose(poseId);
  if (!recipe) throw new Error(`No generation recipe for ${poseId}.`);
  return recipe.build(input);
}

export interface RecipeRunResult {
  recipeId: string;
  poseId: string;
  prompt: string;
  provider: ProviderId;
  model: string;
  data: string;
  mime: string;
  ms: number;
}

/**
 * Runs one built recipe. One image, one call.
 *
 * Deliberately not routed through `renderPoses`: that walks the engine's own
 * pose list and composes its own prompt, and a recipe is precisely the thing
 * that replaces both. Keeping them apart means the customer render path is
 * untouched while recipes are still being proven.
 */
export async function runRecipe(
  build: RecipeBuild,
  options: { provider?: ProviderId; quality?: "standard" | "high"; signal?: AbortSignal } = {},
): Promise<RecipeRunResult> {
  if (build.references.length === 0) throw new Error("The recipe produced no reference images.");

  const provider = getProvider(options.provider);
  const started = Date.now();

  // The provider contract is built around a pose object; a recipe supplies the
  // prompt itself, so the pose here only carries identity.
  const request: RenderRequest = {
    garment: "saree",
    mode: "describe",
    references: build.references,
    scene: "studio",
    poses: [build.poseId],
    quality: options.quality,
  };

  const image = await provider.render({
    request,
    pose: { id: build.poseId, name: build.recipeId, body: "" },
    prompt: build.prompt,
    signal: options.signal,
  });

  return {
    recipeId: build.recipeId,
    poseId: build.poseId,
    prompt: build.prompt,
    provider: provider.id,
    model: image.model,
    data: image.data,
    mime: image.mime,
    ms: Date.now() - started,
  };
}
