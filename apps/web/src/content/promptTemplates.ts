/**
 * The prompts, as templates. Version 2: blocks, not a paragraph.
 *
 * Version 1 was one long paragraph: a legend, the pose, the scene, and the
 * safety rules trailing at the end. It produced the right saree and the wrong
 * placement — pallu print bleeding onto the chest, the chest band drawn on the
 * wrong side of its border, the pallu fused with a sleeve, a scalloped saree
 * end appearing twice. Every one of those was a gap the prompt left open and
 * the image model filled from habit.
 *
 * Version 2 closes the gaps in a fixed order of labelled blocks:
 *
 *   REFERENCE      what is attached and which panel is which part
 *   TASK           copy, do not design — with the safety rules folded in
 *   HOUSE RULES    what a catalogue image never shows, whatever the pose
 *   GARMENT        this saree in words, from SLK and the photographs
 *   PLACEMENT MAP  per pose: which print is allowed where, in camera terms
 *   POSE           per pose
 *   SCENE          the background, hair, jewellery and light
 *   OUTPUT         the image only, no commentary
 *
 * Only two things vary between sarees: GARMENT, and the colour and motif
 * words the placement map borrows from it. Everything else is the same for
 * every product, so the catalogue reads as one shoot.
 *
 * With the defaults — woman, mid-20s, courtyard, sheet, all rules on — and the
 * garment words for 300021, Prompt 1 composes to the proven wording. That is
 * the test that the decomposition lost nothing.
 */

import type { GarmentWords } from "./garmentWords";

export type { GarmentWords } from "./garmentWords";

export type ModelType = "woman" | "man" | "girl" | "boy";
export type BackgroundId = "courtyard" | "studio" | "outdoor";

/**
 * How the photographs reach the model.
 *
 * `files`: four separate attachments, told apart by position — "image 1 is
 * the body". Works only if they are attached in that order.
 * `sheet`: one composited image with BODY / PALLU / BORDER / BLOUSE printed
 * above each panel. Told apart by reading. Nothing to get in the wrong order.
 */
export type AttachMode = "files" | "sheet";

/**
 * Who wears it.
 *
 * `generated`: the model is described — "a woman in her mid-20s" — and the
 * image model invents her. `photo`: a photograph of a real person is attached
 * after the garment references, and the prompt makes that person the model,
 * face and all. The age choice has no meaning then; the photograph has one.
 */
export type ModelSource = "generated" | "photo";

export interface Selections {
  modelType: ModelType;
  modelSource: ModelSource;
  age: string;
  background: BackgroundId;
  attachMode: AttachMode;
  /** Safety rule id → on. */
  rules: Record<string, boolean>;
}

interface Pronouns {
  noun: string;
  She: string;
  she: string;
  her: string;
}

const PRONOUNS: Record<ModelType, Pronouns> = {
  woman: { noun: "woman", She: "She", she: "she", her: "her" },
  man: { noun: "man", She: "He", she: "he", her: "his" },
  girl: { noun: "girl", She: "She", she: "she", her: "her" },
  boy: { noun: "boy", She: "He", she: "he", her: "his" },
};

export const MODEL_TYPES: { id: ModelType; label: string }[] = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "girl", label: "Girl" },
  { id: "boy", label: "Boy" },
];

/** SLK's audience → a default model type. Overridable; only a starting point. */
export function modelTypeFor(audience: string | null | undefined): ModelType {
  const a = (audience ?? "").toLowerCase();
  if (a.includes("men") && !a.includes("women")) return "man";
  if (a.includes("girl")) return "girl";
  if (a.includes("boy")) return "boy";
  return "woman";
}

/** Ages read as they would in a brief. Adults and children have different lists. */
export const ADULT_AGES = ["early 20s", "mid-20s", "late 20s", "early 30s", "mid-30s", "late 30s", "40s"];
export const CHILD_AGES = ["around 5", "around 8", "around 10", "around 12"];

export function agesFor(type: ModelType): string[] {
  return type === "girl" || type === "boy" ? CHILD_AGES : ADULT_AGES;
}

export function defaultAge(type: ModelType): string {
  return type === "girl" || type === "boy" ? "around 8" : "mid-20s";
}

interface Background {
  id: BackgroundId;
  label: string;
  /** The scene sentence. Pronoun tokens are substituted. */
  scene: string;
  lighting: string;
}

export const BACKGROUNDS: Background[] = [
  {
    id: "courtyard",
    label: "Courtyard",
    scene:
      "A sunlit traditional Indian courtyard, framed symmetrically by a single stone arch directly behind {her} head, with pillars on either side, background softly blurred.",
    lighting: "Warm, golden directional lighting.",
  },
  {
    id: "studio",
    label: "Studio",
    scene: "A seamless plain light grey studio backdrop, no props, no visible horizon line.",
    lighting: "Soft, even studio lighting, neutral colour temperature so the fabric colours read true.",
  },
  {
    id: "outdoor",
    label: "Outdoor",
    scene: "An outdoor heritage stone wall with greenery behind {her}, background softly blurred.",
    lighting: "Soft, slightly warm daylight with no harsh shadows on the fabric.",
  },
];

/**
 * Design safety rules — the fidelity clauses as switches.
 *
 * Each one is a sentence in the TASK block when on. They sit up front now, next
 * to the order to copy, rather than trailing the prompt where an image model
 * weights them least. The old "preserve the embroidery" clause is gone: most of
 * these sarees are printed, and the word invited invented texture.
 */
export const SAFETY_RULES: { id: string; label: string; clause: string }[] = [
  { id: "motifs", label: "Do not invent new motifs", clause: "Do not invent motifs." },
  { id: "colour", label: "Preserve original fabric colour", clause: "Preserve the original fabric colours exactly as photographed; do not shift them warmer, cooler, brighter or more saturated." },
  { id: "scale", label: "Maintain scale / design", clause: "Maintain the scale, spacing and layout of the design exactly as in the reference." },
  { id: "border", label: "Preserve border width / details", clause: "Reproduce the border exactly, at its real width; do not widen or restyle it." },
  { id: "placement", label: "Keep pattern placement realistic", clause: "Keep the pattern placement realistic to how this garment is actually draped." },
  { id: "drape", label: "Use realistic draping", clause: "Use realistic draping, with natural folds and shadows." },
];

export function defaultRules(): Record<string, boolean> {
  return Object.fromEntries(SAFETY_RULES.map((r) => [r.id, true]));
}

/** Jewellery follows the model, not the pose. */
function styling(type: ModelType): string {
  switch (type) {
    case "woman":
      return "Styled with gold jhumka earrings, a gold choker-style necklace, and bangles.";
    case "girl":
      return "Styled with small gold earrings.";
    default:
      return "Styled simply, with no jewellery.";
  }
}

/** Hair is fixed so a catalogue of hundreds reads as one shoot. */
function hair(type: ModelType, override?: string): string {
  if (type === "man" || type === "boy") return "";
  return override ?? "Hair tied back in a neat low bun.";
}

export interface PromptTemplate {
  id: string;
  title: string;
  summary: string;
  /** Written and ready to offer. A template exists before it is trusted. */
  live: boolean;
  /**
   * Set once the composed prompt has produced an approved image. From then
   * on the wording of this template, and of every block it draws on, is not
   * edited — a change is a new version, proven again. The record of what was
   * approved lives in docs/studio-prompts.
   */
  frozen?: { version: number; on: string; proof: string };
  /**
   * Which print is allowed where, for this drape, in camera terms. Ends with
   * a transition rule and a "Not allowed" list. The block that stops bleed.
   */
  map: string;
  /** The pose, framing and expression. Opens with the catalogue sentence. */
  pose: string;
  /** A pose's own scene wording for one background — the back view sees the arch past her head. */
  scene?: Partial<Record<BackgroundId, string>>;
  /** A pose's own hair line, when the default would hide something. */
  hair?: string;
}

/*
  Tokens. {She} {she} {her} {Her} are pronouns. The rest are garment words:
  {type} {body_colour} {pallu_colour} {blouse_colour} {border_colour}
  {pallu_motif} {pallu_top} {PalluEnd} (opens a sentence) {palluEnd} (mid-sentence)
  {not_colours} — "not cream, not pale", the colours the body must not be.
*/

const HOUSE_RULES = [
  "HOUSE RULES: These apply to every image.",
  "- The blouse is plain blouse fabric only. No border, no zari, no piping, no trim on the sleeves, neckline or hem.",
  "- Both blouse sleeves are identical: fitted short sleeves ending above the elbow, the same length and width on both arms. The sleeves are separate from the {type} and are never covered, extended or merged with the pallu.",
  "- The midriff and stomach are covered. The {type} is worn at the natural waist, pleats tucked in, and the blouse meets the {type} with no bare skin showing between them. No skin visible at the waist from the front or side.",
  "- The pallu never touches the ground. The {type} hem clears the floor and the feet are visible.",
  "- Nothing is added that is not in the reference photographs: no extra jewellery, no bindi except a small plain one, no tassels, no belt, no brooch, no embroidery, no sequins.",
  "- No text, logo or watermark in the image.",
  "- Every print appears only in the region named for it in the placement map.",
].join("\n");

const OUTPUT = "OUTPUT: Return only the image. No caption, no notes, no commentary.";

const EXPRESSION = "{She} has a direct, confident gaze and a neutral-to-soft expression.";

const FULL_LENGTH =
  "Full-length portrait, tightly framed so {her} figure fills most of the vertical frame, with the top of {her} head, the hem of the {type} and the ground under {her} feet all inside the frame, shot straight-on at eye level with minimal headroom and minimal space around {her}.";

const FULL_LENGTH_ANGLED =
  "Full-length portrait, tightly framed so {her} figure fills most of the vertical frame, with the top of {her} head, the hem of the {type} and the ground under {her} feet all inside the frame, shot at eye level with minimal headroom.";

/*
  The chest band of the front drape, shared by every pose that shows the
  front. Written once because it is the sentence that took the most rounds to
  get right: the band goes from the right hip to the left shoulder, and the
  fabric lies on the LEFT of its border — the model had been mirroring it and
  leaving the left breast in blouse fabric.
*/
const CHEST_BAND =
  "The chest band runs from {her} right hip up to the top of {her} left shoulder. The {border_colour} BORDER is along its upper edge, and the {body_colour} fabric lies on {her} LEFT side of that border line: it covers {her} left breast, {her} left ribs and {her} left side of the torso completely, then passes over the top of the left shoulder. {Her} right shoulder and the right side of {her} chest are the only places where the blouse fabric is visible above the waist. {Her} left breast is {body_colour} BODY print, never {pallu_colour}. The fabric over {her} left breast is the same {body_colour} ground as the skirt, {not_colours}.";

/*
  P2 and P5 share one drape — the pallu forward down the left front — and so
  share one map. Written once; a fix to the drape is a fix to both.
*/
const PALLU_FORWARD_MAP = [
  "PLACEMENT MAP:",
  "1. BLOUSE fabric: the fitted top, sleeves and neckline. The right side of the chest and the right sleeve are fully visible as blouse fabric.",
  "2. PALLU print: one pleated panel that comes from behind over the left shoulder and hangs straight down the front of {her} left side, from the shoulder to just above the hem. This panel, and only this panel, is {pallu_colour} PALLU print. Its full length is visible from top to bottom in the same order as the reference photo: {pallu_top} nearest the shoulder, the {pallu_motif} across the middle, and {palluEnd} at the very bottom.",
  "3. BODY print: everything else on the {type}: the waist, the pleats at the front of the waist, the whole skirt to the hem, all fabric to the right of the pallu panel, and the band of fabric that crosses the chest from the right hip up to the left shoulder. That chest band is {body_colour} BODY print with the {border_colour} border along its upper edge; it is never {pallu_colour}. {body_colour_cap} BODY print has no {pallu_motif}, no pallu motif and no {pallu_colour} pallu ground on it.",
  "4. BORDER: along the hem, along the upper edge of the chest band, and along both long edges of the hanging pallu panel, exactly as narrow as shown.",
  "Transition rule: the {pallu_colour} PALLU print is confined to the single hanging panel on {her} left side. Its two long edges are the {border_colour} border; where the border ends, the {body_colour} BODY print begins.",
  "Not allowed: no pallu motif on the skirt. No {pallu_colour} fabric on the chest band. No zari or border trim on the blouse. The pallu panel must not be folded back, bunched, or hidden behind the arm. The pallu must not reach the floor or pool on the ground; it ends just above the hem.",
].join("\n");

export const TEMPLATES: PromptTemplate[] = [
  {
    id: "P1",
    title: "Front, symmetrical",
    summary: "Hands clasped at the waist, pallu peaked over the left shoulder and away behind.",
    live: true,
    // FROZEN v2. Approved on 300021 with the labelled sheet attached, after
    // six rounds: pallu bleed onto the chest, then the pallu shrunk to a
    // sliver, then the pallu pooling on the floor, then a cape flap fused
    // with the sleeve, then the chest band mirrored. The map below names
    // every one of those. Do not edit this template's wording or the shared
    // blocks it uses without bumping the version and proving it again.
    frozen: { version: 2, on: "2026-09-10", proof: "300021, sheet mode, defaults" },
    map: [
      "PLACEMENT MAP:",
      "1. BLOUSE fabric: the fitted top, both sleeves and the neckline. The left sleeve is fully visible as a fitted short sleeve, not covered by the pallu.",
      `2. BODY print: the whole front of the {type} from the waist to the hem, the pleats at the front of the waist, and the band of fabric crossing the chest. ${CHEST_BAND}`,
      "3. PALLU print: the {pallu_colour} pallu is visible in two places. First, a small pleated peak rising above the top of the left shoulder: this peak is {pallu_colour} PALLU print showing {pallu_top}, gathered into narrow pleats. Second, the pallu passes over the top of the shoulder and falls straight down behind the back; its {pallu_colour} edge is visible from the front behind {her} left arm, ending at mid-calf. {PalluEnd} appears exactly once, at the bottom of the hanging pallu, never at the shoulder. The pallu does not touch the ground.",
      "4. BORDER: along the hem, and along the upper edge of the chest band, exactly as narrow as shown.",
      "Transition rule: the {body_colour} BODY print on the chest band ends at the top of the left shoulder. From the top of the shoulder upward into the peak, and everything behind the shoulder, is {pallu_colour} PALLU print. No {pallu_colour} pallu print on the chest below the shoulder, and no {pallu_motif} on the front of the body.",
      "Not allowed: no {pallu_colour} fabric on the left breast or the left side of the chest. No blouse fabric visible on the left side above the waist. The pallu must not lie over the left sleeve or the upper arm; it touches only the top of the shoulder and then goes behind. No cape, no flap, no loose sheet of fabric spread over the shoulder and arm. {PalluEnd} must not appear at the shoulder. The pallu must not hang down the front of the body. The border must not run as a vertical stripe down the front of the left side. The pallu must not be reduced to a tiny sliver, and must not reach the floor or pool on the ground.",
    ].join("\n"),
    pose: [
      "POSE: A professional fashion catalog photo of {subject} wearing this {type}.",
      "{She} stands facing the camera directly in a symmetrical, centered pose, with both hands clasped together at {her} waist.",
      "The pallu is gathered into 5 to 7 narrow, straight, parallel pleats, pinned at the top of the left shoulder, and thrown over the shoulder from front to back. At the shoulder the pleats rise together as one small {pallu_colour} pointed peak, about a hand's height above the shoulder line, then fall straight behind {her} down {her} back, clear of the arm. The pleats at the front of the waist are 5 to 7 straight vertical folds tucked in at the centre of the waist, falling evenly to the hem, not bunched. All pleats are clean, straight and evenly spaced, like pressed fabric folds.",
      EXPRESSION,
      FULL_LENGTH,
    ].join(" "),
  },
  {
    id: "P2",
    title: "Three-quarter, hand on hip",
    summary: "Turned 30 degrees, pallu forward down the left front so the full pattern reads.",
    live: true,
    // FROZEN v2. Approved on 300021 from the Studio with Claude-read garment
    // words: the pallu panel, the chest band and the blouse all came through.
    // Do not edit this template's wording or the shared blocks it uses
    // without bumping the version and proving it again.
    frozen: { version: 2, on: "2026-09-10", proof: "300021, sheet mode, defaults, described words" },
    map: PALLU_FORWARD_MAP,
    pose: [
      "POSE: A professional fashion catalog photo of {subject} wearing this {type}.",
      "{She} stands at a three-quarter angle, shoulders and hips turned about 30 degrees, with {her} left side nearer the camera so the hanging pallu panel faces the camera, and {her} face turned back toward the camera. {Her} right hand rests lightly on {her} right hip; {her} left arm hangs naturally at {her} side beside the pallu panel, not covering it.",
      "The pallu is gathered into 5 to 7 narrow, straight, parallel pleats at the left shoulder and falls forward down the front of {her} body, flat and open, so its full length, pattern and border are visible to just above the hem. The pleats are clean, straight and evenly spaced, like pressed fabric folds, not bunched or crumpled. The blouse has short sleeves ending above the elbow, forearms bare.",
      EXPRESSION,
      FULL_LENGTH_ANGLED,
    ].join(" "),
  },
  {
    id: "P3",
    title: "Back view, head in profile",
    summary: "Back to the camera, pallu falling down the back, lower drape and hem seen from behind.",
    live: true,
    map: [
      "PLACEMENT MAP (seen from behind):",
      "1. BLOUSE fabric: the back of the fitted top, the back neckline and both sleeves. Plain blouse fabric.",
      "2. PALLU print: one pleated panel that comes over the top of the left shoulder from the front and falls straight down the back, lying over the {type}, ending at mid-calf. This panel, and only this panel, is {pallu_colour} PALLU print. From top to bottom it shows, in the same order as the reference photo, {pallu_top} nearest the shoulder, the {pallu_motif} across the middle, and {palluEnd} at the very bottom.",
      "3. BODY print: everything else visible from behind: the {type} wrapped around the waist, the back of the skirt from the waist to the hem, and both sides of the body beside the pallu panel. {body_colour_cap} BODY print with no {pallu_motif}, no pallu motif and no {pallu_colour} pallu ground on it.",
      "4. BORDER: along the hem, and along both long edges of the hanging pallu panel, exactly as narrow as shown.",
      "Transition rule: the {pallu_colour} PALLU print is confined to the single panel falling down the back from the left shoulder. Its two long edges are the {border_colour} border; where the border ends, the {body_colour} BODY print begins.",
      "Not allowed: no pallu motif on the skirt. No zari or border trim on the blouse. The pallu panel must not be reduced to a sliver, bunched, or twisted; it hangs flat and open down the back so the {pallu_motif} is clearly seen. The pallu panel is no wider than {her} shoulders; it is not spread across the whole back like a shawl. The pallu must not reach the floor or pool on the ground. No bare skin at the waist or lower back.",
    ].join("\n"),
    pose: [
      "POSE: A professional fashion catalog photo of {subject} wearing this {type}.",
      "{She} stands with {her} back squarely to the camera, feet together, head turned to {her} right so {her} face is seen in clean profile. {Her} arms hang naturally at {her} sides with the hands relaxed.",
      "The pallu is gathered into 5 to 7 narrow, straight, parallel pleats at the left shoulder and falls straight down {her} back, flat and open, so its full length, pattern and border are visible to mid-calf against the {body_colour} {type}. The pleats are clean, straight and evenly spaced, like pressed fabric folds, not bunched or crumpled. The blouse has short sleeves ending above the elbow, forearms bare. Neutral-to-soft expression.",
      "Full-length portrait, tightly framed so {her} figure fills most of the vertical frame, with the top of {her} head, the hem of the {type} and the ground under {her} feet all inside the frame, shot at eye level from directly behind with minimal headroom.",
    ].join(" "),
    scene: {
      courtyard:
        "A sunlit traditional Indian courtyard. A single stone arch stands beyond {her}, seen past {her} head, with pillars on either side, background softly blurred.",
    },
    hair: "Hair tied back in a neat low bun so the back neckline of the blouse is visible.",
  },
  {
    id: "P4",
    title: "Waist up, pallu detail",
    summary: "Cropped from the waist up, pallu end brought over the left forearm so its print is in frame.",
    live: true,
    // The v1 wording kept the pallu behind the shoulder, so the "pallu
    // detail" shot barely showed the pallu. Bringing its end over the left
    // forearm puts the pallu print, the border and the blouse in one frame.
    map: [
      "PLACEMENT MAP:",
      "1. BLOUSE fabric: the fitted top, both sleeves and the neckline. {Her} right shoulder and the right side of {her} chest show blouse fabric.",
      `2. BODY print: the fabric at the waist, and the band of fabric crossing the chest. ${CHEST_BAND}`,
      "3. PALLU print: in exactly two places. First, behind the left shoulder, where it begins at the top of the shoulder and goes back. Second, the free end of the pallu, brought forward from behind and resting over {her} left forearm, hanging down from the forearm with its pattern facing the camera, showing the {pallu_motif}; {palluEnd} is at its lowest point. No PALLU print appears on the chest or on the chest band.",
      "4. BORDER: along the upper edge of the chest band, and along the edges of the pallu end resting on the forearm, exactly as narrow as shown.",
      "Transition rule: the change from {body_colour} BODY print to {pallu_colour} PALLU print is one clean line at the top of the left shoulder. The only PALLU print in front of the shoulder line is the section resting on the left forearm.",
      "Not allowed: no {pallu_colour} fabric on the left breast or the chest band. No blouse fabric visible on the left side above the waist. The pallu must not cover the left sleeve or the upper arm; it rests on the bare forearm below the sleeve. No zari or border trim on the blouse. No cape, no flap, no loose sheet of fabric over the shoulder.",
    ].join("\n"),
    pose: [
      "POSE: A professional fashion catalog photo of {subject} wearing this {type}.",
      "Tightly cropped from the waist up. {She} faces the camera with a slight three-quarter turn of the shoulders to {her} right, so the left shoulder is nearer the camera. {Her} left forearm is held across {her} body at waist height with the pallu end draped over it; {her} right hand rests lightly on the left wrist.",
      "The pleats over the shoulder are clean, straight and evenly spaced. The pallu print, the border and the blouse fabric are all in sharp focus. The blouse has short sleeves ending above the elbow, forearms bare.",
      EXPRESSION,
      "Framing shows head, shoulders, and torso to just below the waist; the forearm with the pallu end is fully inside the frame. Shot at eye level.",
    ].join(" "),
  },
  {
    id: "P5",
    title: "Relaxed three-quarter, weight on one leg",
    summary: "Hip angled to the camera, hand on hip, pallu forward down the left front to the hem.",
    live: true,
    // The same drape as Prompt 2 with a different stance, so the same map.
    map: PALLU_FORWARD_MAP,
    pose: [
      "POSE: A professional fashion catalog photo of {subject} wearing this {type}.",
      "{She} stands in a relaxed, natural three-quarter pose, {her} weight shifted onto one leg and {her} hip gently angled toward the camera, the way a person naturally stands when resting on one side, with {her} left side nearer the camera so the hanging pallu panel faces the camera. {Her} right hand rests lightly on {her} right hip; {her} left arm hangs naturally at {her} side beside the pallu panel, not covering it. {Her} head and neck follow the natural line of {her} shoulders, with a soft, easy turn of the face toward the camera, no strain or awkward angle between head and body.",
      "The pallu is gathered into 5 to 7 narrow, straight, parallel pleats at the left shoulder and falls forward down the front of {her} body, flat and open, so its full length, pattern and border are visible to just above the hem. The pleats are clean, straight and evenly spaced, like pressed fabric folds, not bunched or crumpled. The blouse has short sleeves ending above the elbow, forearms bare.",
      EXPRESSION,
      FULL_LENGTH_ANGLED,
    ].join(" "),
    scene: {
      courtyard:
        "A sunlit traditional Indian courtyard, framed by a stone arch behind {her}, with pillars on either side, background softly blurred.",
    },
  },
];

/** One attached file and which part of the garment it shows. */
export interface Attachment {
  slot: string;
  /** The filename the download gave it — `300021-body.png`. */
  file: string;
}

const PART_WORDS: Record<string, (type: string) => string> = {
  body: (t) => `the ${t} body, the main field and its repeating motif`,
  pallu: () => "the pallu, the decorated end that is draped over the shoulder",
  border: () => "the border, the narrow decorated strip that runs along the long edges and the hem",
  blouse: () => "the blouse piece, the fabric for the fitted top",
  "full-drape": (t) => `the whole ${t} laid out`,
  weave: () => "a close-up of the weave",
};

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

/**
 * REFERENCE — which image is which.
 *
 * The parts are told apart by something the model can actually see: a printed
 * label for the sheet, position for separate files. Filenames are never shown
 * to a chat model, which is how the first real test came back with the style
 * copied and every print invented.
 */
function reference(files: Attachment[], type: string, mode: AttachMode, person?: Pronouns): string {
  if (files.length === 0) return "";
  const describe = (slot: string) => (PART_WORDS[slot] ?? (() => slot))(type);
  const n = COUNT_WORDS[files.length] ?? String(files.length);

  const which =
    mode === "sheet"
      ? `The attached image is a sheet of ${files.length} labelled photographs of ONE ${type}. ` +
        files.map((f) => `The panel labelled ${f.slot.toUpperCase()} is ${describe(f.slot)}.`).join(" ") +
        ` Read the label printed above each panel to know which part it is. These are ${n} different fabrics with ${n} different prints. They must never be mixed, blended, or shown in each other's place. The panels keep their own proportions: the BORDER panel shows a narrow strip, and the border on the finished garment must stay that narrow.`
      : `You are given ${files.length} reference photographs of ONE ${type}, attached in this order. ` +
        files.map((f, i) => `Image ${i + 1} is ${describe(f.slot)}.`).join(" ") +
        ` These are ${n} different fabrics with ${n} different prints. They must never be mixed, blended, or shown in each other's place. The border photograph shows a narrow strip, and the border on the finished garment must stay that narrow.`;

  if (!person) return `REFERENCE: ${which}`;

  /*
    The person's photograph is the last attachment, after the garment. It
    needs no label: a person is not mistakable for fabric. What it needs is
    the same kind of order the fabric got — this is THAT person, not a model
    in that person's style — because the default failure is the same: a
    generic, idealised face wearing the right saree.
  */
  const where = mode === "sheet" ? "After the sheet, one more image is attached" : `Image ${files.length + 1} is different`;
  const identity = `${where}: a photograph of a real person. That person is the model. Keep ${person.her} face, facial features, skin tone, hair, and body shape exactly as in that photograph, so that ${person.she} is recognisably the same person. Do not replace ${person.her} with a different or idealised model, and do not change ${person.her} age or build. Change only what ${person.she} is wearing, ${person.her} pose, and the setting: dress ${person.her} in the ${type} from the reference photographs.`;

  return `REFERENCE: ${which} ${identity}`;
}

/** TASK — copy, do not design. The safety rules are its second half. */
function task(type: string, rules: Record<string, boolean>): string {
  const on = (id: string) => (rules[id] ? SAFETY_RULES.find((r) => r.id === id)?.clause : "");
  return [
    `TASK: Photograph THIS ${type} on a model. Do not design a ${type} in this style. Reproduce each part exactly as photographed: the same motifs, the same colours, the same motif scale and spacing, the same border design and width.`,
    on("motifs"),
    "Do not substitute a generic print in the same style. Do not swap one part's design onto another. Do not add embroidery, zari, texture or embellishment that is not in the photographs.",
    on("colour"),
    on("scale"),
    on("border"),
    on("placement"),
    on("drape"),
  ]
    .filter(Boolean)
    .join(" ");
}

/** GARMENT — this saree in words. The only block that changes per product. */
function garment(w: GarmentWords): string {
  const kind = [w.fibre, w.craft, w.type].filter(Boolean).join(" ");
  const width = w.borderWidth ? `, ${w.borderWidth} wide` : "";
  return [
    `GARMENT: A ${kind}.`,
    `- BODY: ${w.bodyDesc}.`,
    `- PALLU: ${w.palluDesc}. ${w.palluEndDesc} is the very end of the ${w.type}.`,
    `- BORDER: ${w.borderDesc}${width}. It runs along the hem and along the long edges of the ${w.type}.`,
    `- BLOUSE: ${w.blouseDesc}. This is a separate fabric from the ${w.type} body and from the pallu.`,
  ].join("\n");
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lowerFirst(s: string): string {
  // "The scalloped edge" → "the scalloped edge"; a proper noun stays as it is.
  return /^(The|A|An)\b/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

const same = (a: string | null, b: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/**
 * The word that tells the pallu apart from the body in the placement map.
 *
 * Usually its ground colour — "cream", so "never cream". When the pallu
 * shares the body's ground (a blue saree whose pallu is blue with peacocks),
 * "never blue" would forbid the body's own colour, so the motif does the
 * telling instead: "never peacock-patterned".
 */
function palluWord(w: GarmentWords): string {
  if (!w.palluColour) return "PALLU-print";
  if (same(w.palluColour, w.bodyColour)) return `${w.palluMotif}-patterned`;
  return w.palluColour;
}

/** "not cream, not pale" — every colour the body ground must not be mistaken for. */
function notColours(w: GarmentWords): string {
  const others = [...new Set([w.palluColour, w.blouseColour].filter((c): c is string => Boolean(c) && !same(c, w.bodyColour)))];
  return [...others.map((c) => `not ${c}`), "not pale"].join(", ");
}

/** Every token in one pass, then the double spaces an empty token leaves. */
function fill(text: string, p: Pronouns, w: GarmentWords, subject: string): string {
  const bodyColour = w.bodyColour ?? "BODY-print";
  const tokens: Record<string, string> = {
    "{She}": p.She,
    "{she}": p.she,
    "{Her}": capitalise(p.her),
    "{her}": p.her,
    "{subject}": subject,
    "{type}": w.type,
    "{body_colour}": bodyColour,
    "{body_colour_cap}": capitalise(bodyColour),
    "{pallu_colour}": palluWord(w),
    "{blouse_colour}": w.blouseColour ?? "BLOUSE-print",
    "{border_colour}": w.borderColour ?? "",
    "{pallu_motif}": w.palluMotif,
    "{pallu_top}": w.palluTopDesc,
    "{PalluEnd}": capitalise(w.palluEndDesc),
    "{palluEnd}": lowerFirst(w.palluEndDesc),
    "{not_colours}": notColours(w),
  };
  let out = text;
  for (const [token, value] of Object.entries(tokens)) out = out.replaceAll(token, value);
  return out.replace(/ {2,}/g, " ");
}

/**
 * The prompt for one template, given the product, the choices, and the files
 * that will be attached alongside it.
 */
export function composePrompt(
  template: PromptTemplate,
  words: GarmentWords,
  s: Selections,
  files: Attachment[] = [],
): string {
  const p = PRONOUNS[s.modelType];
  const fromPhoto = s.modelSource === "photo";
  const subject = fromPhoto
    ? `the ${p.noun} in the attached photograph`
    : `a ${p.noun} ${s.modelType === "girl" || s.modelType === "boy" ? s.age : `in ${p.her} ${s.age}`}`;
  const bg = BACKGROUNDS.find((b) => b.id === s.background) ?? BACKGROUNDS[0]!;

  const scene = [template.scene?.[bg.id] ?? bg.scene, hair(s.modelType, template.hair), styling(s.modelType), bg.lighting]
    .filter(Boolean)
    .join(" ");

  const blocks = [
    reference(files, words.type, s.attachMode, fromPhoto ? p : undefined),
    task(words.type, s.rules),
    HOUSE_RULES,
    garment(words),
    template.map,
    template.pose,
    `SCENE: ${scene}`,
    OUTPUT,
  ];

  return blocks
    .filter(Boolean)
    .map((b) => fill(b, p, words, subject))
    .join("\n\n");
}
