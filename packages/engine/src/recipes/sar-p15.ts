import type { ModelBrief, Reference } from "../types";
import type { PoseRecipe, RecipeBuild, RecipeImage, RecipeInput } from "./types";

/**
 * SAR-P15 · Soft Crossed-Ankle Stance — recipe v2.
 *
 * v2 rewrites the stance instruction. v1 said the right leg "crosses gently"
 * and the ankle "rests near" the left; gemini-3-pro-image read that as feet
 * side by side. The cross is now described mechanically — which foot goes
 * where, what touches what — and the negative list names the failure that
 * actually happened rather than ones imagined in advance.
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

const RECIPE_ID = "SAR-P15/v2";

/**
 * The stance, in one place.
 *
 * Shared by the full recipe and the pose-only diagnostic, so the diagnostic
 * tests the exact words the real recipe sends. Two copies would drift, and the
 * whole point of the diagnostic is that the wording is the constant.
 */
export const POSE_BLOCK: string[] = [
  `POSE — SAR-P15, SOFT CROSSED-ANKLE STANCE`,
  ``,
  `She stands facing the camera directly. Torso upright, zero rotation, shoulders square and level, hips square, head facing forward with her eyes to the camera.`,
  `Her weight is carried entirely on her LEFT leg, which is straight and vertical. Her RIGHT leg crosses OVER it: the right foot is placed across the front of the left foot so that the two ankles overlap and touch, and the right toe rests on the floor beyond the outer edge of the left foot. The legs are in contact. This crossing is the defining feature of the pose and must be obvious at a glance — a relaxed standing rest, not a dancer's pose.`,
  `Both arms hang relaxed beside her body with a slight natural bend at the elbows. Both hands are visible beside her upper thighs.`,
  `Neither hand touches, holds, lifts or gathers the saree at any point.`,
  `Both feet are visible below the hem and clearly readable.`,
  ``,
  // The first list was written from imagination. These are the failures
  // actually observed on this pose: the model put the feet side by side
  // and called it done.
  `Do not produce: feet placed side by side; feet parallel; both feet flat on the floor; a gap between the ankles; one foot merely a little forward of the other; crossed knees instead of crossed ankles; the weight on the right leg; a wide or theatrical leg cross; a walking or mid-step position; a torso twist or lean; a hand on the hip or waist; a hand holding the pallu; feet cropped out of frame.`,
];

/**
 * Diagnostic: the stance and nothing else.
 *
 * Sends no garment photographs and asks for a plain saree, to answer one
 * question — whether four dense textile references are crowding out the pose
 * instruction, or the model simply will not produce this stance.
 */
export function buildPoseOnly(input: {
  model: ModelBrief;
  masterReference?: RecipeImage;
  poseReferenceKind?: "photo" | "silhouette";
}): RecipeBuild {
  const refs: Reference[] = [];
  const lines: string[] = [];
  if (input.masterReference) {
    refs.push({ slot: "extra", data: input.masterReference.data, mime: input.masterReference.mime });
    lines.push(
      input.poseReferenceKind === "silhouette"
        ? `1) POSE DIAGRAM — a flat drawing of the required body position. Match the stance it defines. It is a diagram, not clothing.`
        : `1) POSE REFERENCE — a body-position guide. Match the stance shown here. Take nothing else from this image.`,
    );
  }

  const prompt = [
    `You are a professional Indian fashion-catalogue photographer.`,
    ...(lines.length ? [``, `I am giving you 1 image:`, ``, ...lines] : []),
    ``,
    `TASK`,
    ``,
    `Generate one photorealistic fashion-catalogue photograph of ${describeModel(input.model)}, wearing a plain, unpatterned saree in a single mid-tone colour, in the exact pose defined below. The garment does not matter here. The pose is the whole point.`,
    ``,
    ...POSE_BLOCK,
    ``,
    `FRAMING AND LIGHT`,
    ``,
    `Full body, head to feet, nothing cropped. Figure centred, occupying about 85% of the image height. Straight-on eye-level camera. Plain seamless studio background in a light neutral tone. Even, soft, diffused light.`,
    ``,
    `BEFORE YOU FINISH, VERIFY`,
    ``,
    `1. Full body visible, nothing cropped`,
    `2. Facing camera, torso not rotated`,
    `3. Weight on the LEFT leg`,
    `4. Right foot crossed OVER the left, ankles overlapping and touching, right toe on the floor — NOT feet side by side`,
    `5. Both arms relaxed at her sides, neither hand touching the saree`,
    `6. Both feet visible below the hem`,
  ].join("\n");

  return {
    recipeId: `${RECIPE_ID}#pose-only`,
    poseId: "SAR-P15",
    version: 2,
    prompt,
    references: refs,
    warnings: ["Diagnostic run: no garment references sent, garment output is meaningless."],
  };
}

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

  if (assets.masterReference && assets.poseReferenceKind === "silhouette") {
    push(assets.masterReference, "extra", (n) =>
      `${n}) POSE DIAGRAM — a flat drawing of the required body position. Match the stance it defines: the crossed ankle, the weight distribution, the arm position and the framing. It is a diagram, not a photograph and not clothing. Take no colour, no fabric, no texture and no garment information from it whatsoever.`,
    );
  } else if (assets.masterReference) {
    push(assets.masterReference, "extra", (n) =>
      // Deliberately impersonal. An earlier version described "a different
      // woman" and told the model not to copy "her face, her identity", which
      // reads as a request about a specific person and is the kind of phrasing
      // person-generation filters decline. The instruction is the same; the
      // subject of the sentence is the body position, not a person.
      `${n}) POSE REFERENCE — a body-position guide. Match the stance shown here: the crossed ankle, the weight distribution, the arm position, the camera angle and the framing. Take nothing else from this image. The clothing in it is a plain placeholder and must not appear in your output — not its colour, not its fabric, not its plainness.`,
    );
  }
  push(assets.body, "body", (n) =>
    `${n}) SAREE BODY — the main field of the saree. It wraps the lower body and is pleated at the waist, falling to the ankles. Its motif, motif scale, motif spacing and colour define the whole lower garment.`,
  );
  push(assets.pallu, "pallu", (n) =>
    `${n}) PALLU — the decorated end. It is pleated and draped over the LEFT shoulder, its loose length hanging down her left side. Its design is usually different from the body; keep that difference.`,
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
  version: 2,

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
      ...POSE_BLOCK,
      ``,
      `GARMENT CONSTRUCTION`,
      ``,
      `The saree is draped in the standard Nivi style. The body of the saree wraps the lower body and is pleated at the waist, the pleats falling straight and evenly to the ankles. The pallu is pleated and worn over the LEFT shoulder, and its loose length falls down her LEFT SIDE, hanging clear of the arm rather than across the front of the body. The border runs along both long edges and across the bottom hem. The blouse is fitted with short sleeves that end above the elbow, well before the elbow joint, exposing the forearm.`,
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
      `4. Right foot crossed OVER the left, ankles overlapping and touching, right toe on the floor — NOT feet side by side`,
      `5. Both arms relaxed at her sides`,
      `6. Neither hand touching the saree`,
      `7. Both feet visible below the hem`,
      `8. Pallu over the LEFT shoulder, its length falling down her left side`,
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

    return { recipeId: RECIPE_ID, poseId: "SAR-P15", version: 2, prompt, references: refs, warnings };
  },
};
