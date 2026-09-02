export * from "./types";
export { SLOTS, slot, slotsFor, slotLabel, slotHint, isDraped } from "./slots";
export type { SlotDef } from "./slots";
export { GARMENTS, garment } from "./garments";
export type { GarmentDef } from "./garments";
export { POSES, pose, posesFor, hasPallu, DEFAULT_POSE_IDS } from "./poses";
export { SCENES, scene } from "./scenes";
export { composePrompt, referenceLegend, componentLegend } from "./compose";
export { PLAYBOOK_PROMPTS } from "./playbook";
export { guessMime, toRawBase64, toDataUrl } from "./mime";
export { getProvider, configuredProviders, PROVIDER_IDS } from "./providers/index";
export { renderPoses, validateRequest } from "./render";
export type { RenderOptions } from "./render";
// Per-pose generation recipes. Server-only: running one calls a provider.
export {
  buildRecipe,
  recipeForPose,
  recipeById,
  runRecipe,
  SAR_P15_RECIPE,
} from "./recipes/index";
export type {
  PoseRecipe,
  RecipeAssets,
  RecipeBuild,
  RecipeImage,
  RecipeInput,
  RecipeRunResult,
} from "./recipes/index";
