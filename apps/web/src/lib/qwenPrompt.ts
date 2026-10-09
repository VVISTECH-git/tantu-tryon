import type { Garment, GenerationLook } from "@/db";
import type { ImageOption } from "@/lib/imageModels";
import { poseFor, primaryPose } from "@/content/poses";

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

const GARMENT: Record<string, { name: string; worn: string; rules: string; childName?: string; childWorn?: string }> = {
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
    worn: "worn as it is cut, with nude block-heel sandals, holding a small woven straw tote bag",
    // A child's frock (9 Oct, a girl's dress on a small hanger): its own length, no heels or bag.
    childName: "frock",
    childWorn: "worn as it is cut, with small white strap sandals",
    rules: "Keep the print exactly as in the photo: same flowers and leaves, same colours, same scale of the pattern, same neckline, same sleeves, same frills or tiers if the photo shows them. The neckline is open and edged in the same printed fabric: a dark or plain patch seen inside the neck in photo 1 is the inside of the frock's back (or the background) showing through the opening, not a panel or yoke, so do not copy it. Do not redraw, simplify, recolour or add any decoration.",
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
  woman: "a beautiful young North Indian woman, slim, with a fresh youthful college-age look, fine natural skin texture, minimal natural makeup, a small round red bindi on her forehead, a fine gold chain necklace, small gold stud earrings and a thin gold bangle",
  man: "a professional North Indian male fashion model, well-groomed, natural North Indian complexion, athletic build, confident calm expression, short neat hair",
  // Same look as the women (user, 9 Oct): North Indian, light wheatish skin. No bindi on children ("it doesn't suit").
  girl: "a cute young North Indian girl, light wheatish skin, a cheerful natural smile, no bindi, hair in two neat plaits",
  boy: "a cute young North Indian boy, light wheatish skin, a cheerful natural smile, short neat hair",
};

/*
  Rotated per product (user, 8 Oct: "the hairstyle is the same across, the model is the same
  across — rotate them"). A product keeps one model and one hairstyle in all its poses; the
  next product gets another. Natural Indian skin tones, no "fair".
*/
const FACES = [
  // 9 Oct, user: the models looked dark and older ("aunties"); they want young North Indian
  // women of about 20 with light, wheatish skin.
  "a youthful oval face, fair wheatish skin, large dark eyes and a soft open smile",
  "a youthful heart-shaped face, light wheatish skin, defined brows and a warm smile",
  "a round youthful face, fair skin with a warm undertone and a dimpled cheerful smile",
  "high cheekbones, light golden-wheatish skin, almond eyes and a confident closed-lip smile",
  "a soft youthful face, fair wheatish skin, gentle eyes and a calm smile",
  "a slim youthful face, light honey-wheatish skin and a bright smile",
];
const HAIR = [
  "long dark hair in a loose braid falling forward over one shoulder",
  "dark hair in a neat low bun at the nape",
  "long dark hair worn open in soft waves past the shoulders",
  "dark hair in a high sleek ponytail",
  "long dark hair half tied up, the rest falling open behind",
  "long dark hair side-parted and swept over one shoulder",
  "sleek straight dark hair worn open, centre-parted",
  "dark hair in a soft messy bun with a few loose strands framing the face",
];

/** A product's own index into the rotations, the same on every run (FNV-1a of its ID). */
function pick(seed: string): number {
  let h = 0x811c9dc5;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h;
}

const SCENE: Record<string, string> = {
  studio: "plain light-grey seamless studio backdrop, soft even studio light, neutral white balance, catalogue photo",
  courtyard: "a sunlit traditional Indian courtyard with a stone arch and pillars softly blurred behind, warm golden light",
  outdoor: "a quiet garden path with green foliage softly blurred behind, soft daylight",
  gallery: "a bright minimalist modern art gallery, light grey polished concrete floor, white walls with large framed abstract paintings in warm beige, taupe and charcoal tones and a small sculpture on a pedestal, softly blurred behind her; bright, even, neutral daylight from tall windows, gentle realistic shadows on the floor, neutral white balance that keeps the garment's colours true",
};

export function qwenPrompt(garment: Garment, promptId: string, look: GenerationLook): string {
  const base = GARMENT[garment.garmentType] ?? GARMENT.kurti!;
  const child = look.modelType === "girl" || look.modelType === "boy";
  const g = { ...base, name: (child && base.childName) || base.name, worn: (child && base.childWorn) || base.worn };
  const p = poseFor(garment.garmentType, promptId) ?? primaryPose(garment.garmentType);
  // Adults are about 20 (user's choice); the age picked for a child stands.
  const age = look.modelType === "girl" || look.modelType === "boy" ? look.age : "about 20 years old";
  // Numbered products (KW-0088) step through the faces and hairstyles in turn, so neighbours never
  // share a model; anything else is spread by a hash of its ID.
  const n = Number((garment.productCode ?? "").match(/(\d+)$/)?.[1] ?? NaN);
  const seed = Number.isFinite(n) ? n : pick(garment.productCode ?? garment.id ?? "");
  const looks = look.modelType === "woman" ? `, ${FACES[seed % FACES.length]}, ${HAIR[(seed * 3 + 1) % HAIR.length]}` : "";
  const model = `${MODEL[look.modelType] ?? MODEL.woman}${looks}, ${age}`;
  const scene = SCENE[look.background] ?? SCENE.studio!;
  const framing = p.framing === "full" ? "full-length photo from head to feet" : p.framing === "waist" ? "photo from the waist up" : "close photo of the garment detail";
  const extra = qwenInputs(garment).length > 1 ? " Photos 2 and 3 show the same garment's other parts; use them for those parts." : "";
  // The garment's cut as read from its own photo (8 Oct): stated as fixed facts, so nothing is guessed.
  const spec = garment.words?.garmentSpec;
  return [
    `Photo 1 shows a ${g.name}.${extra} Make one catalogue photograph of this exact ${g.name} ${g.worn}, on ${model}.`,
    ...(spec ? [`The garment in photo 1, read closely — these details are fixed and must be copied exactly: ${spec}`] : []),
    `Priority: 1. the garment's fabric, print and colours exactly as in the photos; 2. correct anatomy (one person, two arms, two hands, five fingers each); 3. pose and framing; 4. a natural, original face.`,
    g.rules,
    // 9 Oct, user: "you cannot imagine and draw — you have to draw based on what you see" (a back bow drawn on the front).
    `Draw only what the photos show, and only where they show it. A detail seen only on the back of the garment (a bow, a tie, a zip, buttons) is only on the back: it must not appear in a front or side view. Do not invent any detail the photos do not show.`,
    `Colour: keep every colour of the fabric exactly as bright, as saturated and as light or dark as in photo 1; do not mute, grey, warm or darken them.`,
    `Pose: ${p.how}. ${framing}, camera at chest height, 3:4 portrait.`,
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
