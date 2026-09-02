import type { ModelBrief, Reference } from "../types";

/**
 * A generation recipe.
 *
 * The registry record says what a pose *is*. The recipe says what to *tell the
 * generator* to produce it, and in what order to hand over the images.
 *
 * One recipe per pose, deliberately. A universal prompt cannot know that P15
 * exists to sell the hem line while P12 exists to sell the pallu motif, and the
 * instruction that protects one will not protect the other.
 */

export interface RecipeImage {
  /** Raw base64 or a data URL; the provider normalises it. */
  data: string;
  mime?: string;
}

export interface RecipeAssets {
  /**
   * The approved photorealistic master reference for the pose.
   *
   * Pose control only. It is NOT part of the garment, and the prompt must say
   * so explicitly or the model reads its plain fabric as the saree's texture.
   */
  masterReference?: RecipeImage;
  body: RecipeImage;
  pallu: RecipeImage;
  border: RecipeImage;
  blouse: RecipeImage;
  fullDrape?: RecipeImage;
  weave?: RecipeImage;
}

export interface RecipeInput {
  model: ModelBrief;
  assets: RecipeAssets;
}

export interface RecipeBuild {
  recipeId: string;
  poseId: string;
  version: number;
  prompt: string;
  /** In the exact order the prompt's legend numbers them. */
  references: Reference[];
  /** Anything the operator should know before spending money on this run. */
  warnings: string[];
}

export interface PoseRecipe {
  /** `SAR-P15/v1`. Recorded on every run, so an image can be traced to it. */
  id: string;
  poseId: string;
  version: number;
  build(input: RecipeInput): RecipeBuild;
}
