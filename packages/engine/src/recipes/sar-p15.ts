import type { ModelBrief, Reference } from "../types";
import type { PoseRecipe, RecipeBuild, RecipeImage, RecipeInput } from "./types";

/**
 * SAR-P15 · Soft Crossed-Ankle Stance — recipe v1.
 *
 * Specific to this pose on purpose. Its whole reason to exist is
 * `showcasePurpose: ["hem line", "lower border", "slim silhouette"]`, so the
 * instructions that matter most here are the ones that keep the feet in frame
 * and the hem readable — instructions that would be pointless on a macro pose
 * and wrong on a pallu-spread pose.
 *
 * Two devices carried over from the prompt that produced the accepted P01
 * silhouette, because they are what made it reliable: every instruction is
 * paired with its failure mode, and the whole thing ends in a numbered check
 * list that doubles as the QC sheet.
 */

const RECIPE_ID = "SAR-P15/v1";

function describeModel(brief: ModelBrief): string {
  if (brief.freeform?.trim()) return brief.freeform.trim();
  return [
    "a woman",
    brief.age?.trim() || "in her mid-20s",
    brief.build?.trim() || "of average height and build",
    brief.complexion?.trim() || "with a warm Indian complexion",
    brief.hair?.trim() || "with dark hair worn down",
    brief.expression?.trim() || "with a direct, calm expression",
  ].join(", ");
}

/** The numbered legend. Order here IS the order images are sent. */
function legend(assets: RecipeInput["assets"]) {
  const refs: Reference[] = [];
  const lines: string[] = [];
  const push = (image: RecipeImage, slot: Reference["slot"], line: (n: number) => string) => {
    refs.push({ slot, data: image.data, mime: image.mime });
    lines.push(line(refs.length));
  };

  if (assets.masterReference) {
    push(assets.masterReference, "extra", (n) =>
      `${n}) POSE REFERENCE — a photograph of a different woman in a plain saree, supplied ONLY to define body position. Copy the body geometry from it: the stance, the crossed ankle, the arm position, the camera angle and the framing. Do NOT copy her face, her identity, her saree, its colour, its fabric or its plainness. Nothing about the garment in this image belongs in your output.`,
    );
  }
  push(assets.body, "body", (n) =>
    `${n}) SAREE BODY — the main field of the saree. It wraps the lower body and is pleated at the waist, falling to the ankles. Its motif, motif scale, motif spacing and colour define the whole lower garment.`,
  );
  push(assets.pallu, "pallu", (n) =>
    `${n}) PALLU — the decorated end. It is pleated and draped over the LEFT shoulder and falls from that shoulder. Its design is usually different from the body; keep that difference.`,
  );
  push(assets.border, "border", (n) =>
    `${n}) BORDER — the narrow decorated strip. It runs along BOTH long edges of the saree and across the bottom hem. Keep its width in correct proportion to the saree.`,
  );
  push(assets.blouse, "blouse", (n) =>
    `${n}) BLOUSE PIECE — the fabric of the fitted top, worn on the torso with short sleeves ending above the elbow.`,
  );
  if (assets.fullDrape) {
    push(assets.fullDrape, "full-drape", (n) =>
      `${n}) FULL SAREE REFERENCE — the whole saree, for overall layout and proportion between the parts.`,
    );
  }
  if (assets.weave) {
    push(assets.weave, "weave", (n) =>
      `${n}) WEAVE DETAIL — a macro of the weave or hand-painted line work. A colour and texture reference only, not a separate piece of the garment.`,
    );
  }
  return { refs, lines };
}

export const SAR_P15_RECIPE: PoseRecipe = {
  id: RECIPE_ID,
  poseId: "SAR-P15",
  version: 1,

  build(input: RecipeInput): RecipeBuild {
    const { refs, lines } = legend(input.assets);
    const who = describeModel(input.model);
    const styling = input.model.styling?.trim();
    const warnings: string[] = [];

    if (!input.assets.masterReference) {
      warnings.push(
        "No master reference: the crossed ankle is described in words only, which is the least reliable way to get it.",
      );
    }

    const prompt = [
      `You are a professional Indian fashion-catalogue photographer and virtual dresser.`,
      ``,
      `I am giving you ${refs.length} images, in this order:`,
      ``,
      lines.join("\n"),
      ``,
      `Images ${input.assets.masterReference ? 2 : 1} onward are photographs of the parts of ONE saree. They are not separate garments and not decorative images. Assemble them into a single coherent saree.`,
      ``,
      `Ignore any shop background, price tag, label, hand or table surface in the reference photographs — use only the garment fabric and its print.`,
      ``,
      `TASK`,
      ``,
      `Generate one photorealistic fashion-catalogue photograph of ${who}, wearing that saree, in the exact pose defined below.`,
      ``,
      `POSE — SAR-P15, SOFT CROSSED-ANKLE STANCE`,
      ``,
      `She stands facing the camera directly. Torso upright, zero rotation, shoulders square and level, hips square, head facing forward with her eyes to the camera.`,
      `Her weight is carried on her LEFT leg, which is straight and supporting. Her RIGHT leg crosses gently in front so that the right ankle rests near the left — a relaxed standing rest, not a dancer's pose.`,
      `Both arms hang relaxed beside her body with a slight natural bend at the elbows. Both hands are visible beside her upper thighs.`,
      `Neither hand touches, holds, lifts or gathers the saree at any point.`,
      `Both feet are visible below the hem and clearly readable.`,
      ``,
      `Do not produce: crossed knees instead of crossed ankles; the weight on the right leg; a wide or theatrical leg cross; a walking or mid-step position; a torso twist or lean; a hand on the hip or waist; a hand holding the pallu; feet cropped out of frame.`,
      ``,
      `GARMENT CONSTRUCTION`,
      ``,
      `The saree is draped in the standard Nivi style. The body of the saree wraps the lower body and is pleated at the waist, the pleats falling straight and evenly to the ankles. The pallu is pleated and worn over the LEFT shoulder, falling naturally down the front. The border runs along both long edges and across the bottom hem. The blouse is fitted with short sleeves that end above the elbow, well before the elbow joint, exposing the forearm.`,
      ``,
      `TEXTILE FIDELITY — THE THING THAT MATTERS MOST`,
      ``,
      `Reproduce the saree exactly as photographed. The same colours, the same motifs, the same motif scale, the same motif spacing, the same border design, the same border width, the same pallu design and the same weave texture. Where the drape hides part of the garment, extrapolate it so it stays consistent with what is visible.`,
      ``,
      `Do not redesign, stylise, simplify, re-colour, re-scale or reinterpret the pattern. Do not invent motifs that are not in the reference photographs. Do not substitute a generic saree print. Do not swap the pallu design onto the body, or the body design onto the pallu. Do not change the border width. Do not shift the colours warmer, cooler, brighter or more saturated than photographed.`,
      ``,
      `WHAT THIS POSE EXISTS TO SHOW`,
      ``,
      `The hem line, the lower border and the slim silhouette. The bottom of the saree and both feet must be fully in frame and in focus. The lower border must be legible enough that a buyer can judge it.`,
      ``,
      `FRAMING AND LIGHT`,
      ``,
      `Full body, head to feet, nothing cropped. Figure centred, occupying about 85% of the image height. Straight-on eye-level camera, no tilt, no perspective distortion. Plain seamless studio background in a light neutral tone. Even, soft, diffused light with a soft contact shadow at the feet only.`,
      ``,
      styling ? `Styled with ${styling}.` : ``,
      ``,
      `Photorealistic, high detail, sharp on the fabric. No text, no watermark, no logo, no collage, no border frame around the image, and no additional people.`,
      ``,
      `BEFORE YOU FINISH, VERIFY`,
      ``,
      `1. One woman, photorealistic, full body, nothing cropped`,
      `2. Facing camera, torso not rotated, shoulders level`,
      `3. Weight on the LEFT leg`,
      `4. Right ANKLE crossed in front, not the knees`,
      `5. Both arms relaxed at her sides`,
      `6. Neither hand touching the saree`,
      `7. Both feet visible below the hem`,
      `8. Pallu over the LEFT shoulder, falling down the front`,
      `9. Waist pleats straight and even`,
      `10. Border on both long edges and across the hem, correct width`,
      `11. Blouse sleeves ending above the elbow`,
      `12. Body motif identical to the reference, at the same scale and spacing`,
      `13. Pallu design identical to its reference and still different from the body`,
      `14. Colours unchanged from the references`,
      `15. Lower border legible`,
    ]
      .filter((line) => line !== undefined)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");

    return { recipeId: RECIPE_ID, poseId: "SAR-P15", version: 1, prompt, references: refs, warnings };
  },
};
