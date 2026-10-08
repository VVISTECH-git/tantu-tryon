import type { Garment, GenerationLook } from "@/db";
import type { ImageOption } from "@/lib/imageModels";

/**
 * The Qwen track (8 Oct): Qwen-Image-Edit-2511 running on the shop's own
 * laptop, free, so Tantu does not depend on Gemini. Jobs are queued here and
 * picked up by the laptop worker (C:\SareeAI\tantu_worker.py).
 *
 * The prompt keeps the shape Drapify uses for Gemini (priority ladder, the
 * reference photo named, garment rules, pose, scene, a short check) at a
 * tenth of the length: Qwen follows short direct instructions better than
 * pages of capitals. Honest Indian skin tones; no "fair", no idealised body.
 */

export const QWEN_PROVIDER = "qwen-local";
export const QWEN_MODEL = "qwen-image-edit-2511-q4";

export const isQwenOption = (option: ImageOption): boolean => option.model === QWEN_MODEL;

/**
 * Output size (user, 8 Oct: "2K / 4K like Gemini"). The card draws at 3:4 up to
 * ~1K in a few minutes; a sharpening upscaler then takes it to 2K (standard)
 * or 4K (high), the way studios deliver print sizes.
 */
export function qwenSize(quality: GenerationLook["quality"]): { width: number; height: number; upscale: 2 | 4; label: "2K" | "4K" } {
  return quality === "high" ? { width: 1024, height: 1365, upscale: 4, label: "4K" } : { width: 1024, height: 1365, upscale: 2, label: "2K" };
}

const GARMENT: Record<string, { name: string; worn: string; rules: string }> = {
  saree: {
    name: "saree",
    worn: "draped in the standard Nivi style: pleats at the front centre, the pallu over the left shoulder falling behind, the border running along the bottom hem, with a plain blouse matching the border colour",
    rules: "Keep the saree's body print, border and pallu exactly as in the photo: same motifs, colours and scale. The blouse is plain; blouse fabric never appears on the saree. The saree reaches the floor.",
  },
  kurti: {
    name: "kurti",
    worn: "worn as a straight-cut kurti falling to the knee, with plain black leggings and simple flat sandals",
    rules: "Keep the print exactly as in the photo: same motifs, same colours, same size and spacing of the repeat, same neckline shape, same sleeve length, same hem. Do not redraw, simplify, recolour or add any decoration. No dupatta unless one is in the photo.",
  },
  frock: {
    name: "frock (long flared dress)",
    worn: "worn as a long flared frock, fitted at the waist and flowing to the ankle, with simple flat sandals",
    rules: "Keep the print exactly as in the photo: same flowers and leaves, same colours, same scale of the pattern, same neckline, same sleeves, same frills or tiers if the photo shows them. The inside of the neckline is the same fabric as the frock. Do not redraw, simplify, recolour or add any decoration.",
  },
  blouse: {
    name: "saree blouse",
    worn: "worn as a fitted blouse with a plain solid-colour saree in a colour taken from the blouse, draped simply so the blouse stays fully visible",
    rules: "Keep the blouse's print, neckline and sleeves exactly as in the photo. The saree is plain and unprinted.",
  },
  coord_set: {
    name: "co-ord set (kurti with matching pants)",
    worn: "worn as a matching set: the top with its own matching pants from the photo, with simple flat sandals",
    rules: "Keep both pieces' print exactly as in the photo: same motifs, colours and scale. Do not change the pants' fabric or add a dupatta.",
  },
  lehenga: {
    name: "top and skirt set",
    worn: "worn as a set: the top with its long flared skirt from the photo",
    rules: "Keep both pieces' print, colours and borders exactly as in the photo. The skirt reaches the ankle.",
  },
  dupatta: {
    name: "dupatta",
    worn: "draped over a plain solid-colour kurti in a colour taken from the dupatta, the dupatta over one shoulder and falling in front",
    rules: "Keep the dupatta's print, border and tassels exactly as in the photo. The kurti is plain and unprinted.",
  },
};

// User (8 Oct): North Indian models, about 20 years old, and pleasant to look at: a
// professional catalogue model, not a passer-by (the first plain wording was rejected).
const MODEL: Record<string, string> = {
  woman: "a professional North Indian female fashion model, polished attractive features, symmetrical face, clear glowing skin in a natural North Indian complexion, slim graceful figure, light natural makeup, a soft pleasant smile, hair neatly styled in a low bun",
  man: "a professional North Indian male fashion model, well-groomed, natural North Indian complexion, athletic build, confident calm expression, short neat hair",
  girl: "a real Indian girl, natural medium-brown Indian skin tone, cheerful expression, hair in two plaits",
  boy: "a real Indian boy, natural medium-brown Indian skin tone, cheerful expression, short neat hair",
};

const SCENE: Record<string, string> = {
  studio: "plain light-grey seamless studio backdrop, soft even studio light, neutral white balance, catalogue photo",
  courtyard: "a sunlit traditional Indian courtyard with a stone arch and pillars softly blurred behind, warm golden light",
  outdoor: "a quiet garden path with green foliage softly blurred behind, soft daylight",
};

/** The pose for each prompt id, in a sentence; the saree ones name the pallu, the others their own equivalent. */
function pose(promptId: string, isSaree: boolean): string {
  switch (promptId) {
    case "P2":
      return isSaree
        ? "turned about 30 degrees to the camera, one hand on the hip, the pallu forward down the left front so its full pattern shows"
        : "turned about 30 degrees to the camera, one hand on the hip, the other relaxed";
    case "P3":
      return isSaree
        ? "back to the camera, head turned in profile, the pallu falling down the back, the hem and lower drape seen from behind"
        : "back to the camera, head turned in profile, so the back of the garment shows";
    case "P4":
      return isSaree
        ? "framed from the waist up, the pallu end brought over the left forearm so its print fills the frame"
        : "framed from the waist up, hands gently holding the garment so its print fills the frame";
    case "P5":
      return "relaxed three-quarter stance, weight on one leg, hip angled to the camera, one hand on the hip";
    default:
      return "standing straight, weight even, arms relaxed at the sides, looking at the camera";
  }
}

export function qwenPrompt(garment: Garment, promptId: string, look: GenerationLook): string {
  const g = GARMENT[garment.garmentType] ?? GARMENT.kurti!;
  // Adults are about 20 (user's choice); the age picked for a child stands.
  const age = look.modelType === "girl" || look.modelType === "boy" ? look.age : "about 20 years old";
  const model = `${MODEL[look.modelType] ?? MODEL.woman}, ${age}`;
  const scene = SCENE[look.background] ?? SCENE.studio!;
  const framing = promptId === "P4" ? "photo from the waist up" : "full-length photo from head to feet";
  const extra = qwenInputs(garment).length > 1 ? " Photos 2 and 3 show the same garment's other parts; use them for those parts." : "";
  return [
    `Photo 1 shows a ${g.name}.${extra} Make one catalogue photograph of this exact ${g.name} ${g.worn}, on ${model}.`,
    `Priority: 1. the garment's fabric, print and colours exactly as in the photos; 2. correct anatomy (one person, two arms, two hands, five fingers each); 3. pose and framing; 4. a natural, original face.`,
    g.rules,
    `Pose: ${pose(promptId, garment.garmentType === "saree")}. ${framing}, camera at chest height, 3:4 portrait.`,
    `Scene: ${scene}. Remove the mannequin, hanger, vase, flowers, floor and any shop background from the photo.`,
    `The result is a sharp, well-lit, high-end catalogue photograph of a real person, not an illustration. Natural skin texture, no waxy or plastic look. No text, no watermark, no extra people.`,
  ].join("\n");
}

/** The photos Qwen gets, in order: the garment first, then its parts; at most three (the edit node's limit). */
export function qwenInputs(garment: Garment): { slot: string; key: string }[] {
  const order = ["whole", "saree", "body", "pallu", "blouse", "border", "body_motif", "pallu_motif"];
  return garment.parts
    .filter((p) => p.key)
    .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot))
    .slice(0, 3)
    .map((p) => ({ slot: p.slot, key: p.key! }));
}
