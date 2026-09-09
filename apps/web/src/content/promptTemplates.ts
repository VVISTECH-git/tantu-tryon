/**
 * The prompts, as templates.
 *
 * A prompt used to be stored text. Now it is a sentence with slots, and the
 * slots are filled from two places: what the product record says (a *cotton*
 * *saree*, from SLK's fibre and product type) and what the person chose on the
 * left (a *woman* in her *mid-30s*, in a *courtyard*). Change a choice and the
 * prompt rewrites itself.
 *
 * The pose is the one thing a template owns outright. It is what makes
 * Prompt 1 Prompt 1, and it is never a slot.
 *
 * With the defaults — woman, mid-20s, courtyard, no safety rules — Prompt 1
 * composes to the proven wording word for word. That is the test that the
 * decomposition lost nothing.
 */

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

export interface Selections {
  modelType: ModelType;
  age: string;
  background: BackgroundId;
  attachMode: AttachMode;
  /** Safety rule id → on. */
  rules: Record<string, boolean>;
}

/** The words the template needs from the product. */
export interface GarmentWords {
  /** "cotton", from fibreType. Null when SLK has not recorded one. */
  fibre: string | null;
  /** "saree", from productType. */
  type: string;
}

interface Pronouns {
  noun: string;
  She: string;
  she: string;
  her: string;
  /** "a woman" / "a girl" — the article is always "a" here. */
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
      "{She} is positioned in a sunlit traditional Indian courtyard, framed symmetrically by a single stone arch directly behind {her} head, with pillars on either side, background softly blurred.",
    lighting: "Warm, golden directional lighting.",
  },
  {
    id: "studio",
    label: "Studio",
    scene: "{She} stands against a plain seamless studio backdrop in a soft neutral tone.",
    lighting: "Even, soft, diffused studio lighting.",
  },
  {
    id: "outdoor",
    label: "Outdoor",
    scene: "{She} stands in a quiet garden, greenery softly blurred behind {her}.",
    lighting: "Soft, natural daylight.",
  },
];

/**
 * Design safety rules — the fidelity clauses as switches.
 *
 * Each one is a sentence appended when on. They are the same protections the
 * generation recipe carried, surfaced so a person can see them and turn one
 * off when a garment genuinely calls for it.
 */
export const SAFETY_RULES: { id: string; label: string; clause: string }[] = [
  { id: "colour", label: "Preserve original fabric colour", clause: "Preserve the original fabric colours exactly as photographed; do not shift them warmer, cooler, brighter or more saturated." },
  { id: "scale", label: "Maintain scale / design", clause: "Maintain the scale, spacing and layout of the design exactly as in the reference." },
  { id: "border", label: "Preserve embroidery / border details", clause: "Preserve the embroidery and border details, including the border's width." },
  { id: "motifs", label: "Do not invent new motifs", clause: "Do not invent motifs that are not present in the reference image." },
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

type Slot =
  | "opening"
  | "pose"
  | "blouse"
  | "expression"
  | "framing"
  | "background"
  | "styling"
  | "lighting";

export interface PromptTemplate {
  id: string;
  title: string;
  summary: string;
  /** Written and ready to offer. A template exists before it is trusted. */
  live: boolean;
  /**
   * The order the sentences go in. Each proven prompt has its own — Prompt 2
   * puts the pose last — and that order is part of what was proven.
   */
  order: Slot[];
  /**
   * @param refs — "reference images" or "reference sheet", to match what is
   *   actually attached. The proven wording said "the reference image",
   *   singular, which read wrongly after a legend listing four.
   */
  opening: (g: GarmentWords, p: Pronouns, subject: string, refs: string) => string;
  pose: string;
  blouse?: string;
}

const EXPRESSION = "{She} has a direct, confident gaze and a neutral-to-soft expression.";
const FRAMING =
  "Full-length portrait, tightly framed so {her} figure fills most of the vertical frame from head to feet, shot straight-on at eye level with minimal headroom and minimal space around {her}.";

export const TEMPLATES: PromptTemplate[] = [
  {
    id: "P1",
    title: "Front, symmetrical",
    summary: "Hands clasped at the waist, pallu peaked over the left shoulder and away behind.",
    live: true,
    order: ["opening", "pose", "expression", "framing", "background", "styling", "lighting"],
    opening: (g, _p, subject, refs) =>
      `A professional fashion catalog photo of ${subject} wearing the ${garmentWords(g)} shown in the attached ${refs}.`,
    pose:
      "{She} stands facing the camera directly in a symmetrical, centered pose, with both hands clasped together at {her} waist. The saree pallu is pleated neatly and thrown up and over the left shoulder from front to back, forming a distinct peaked, pointed shape of fabric rising at the shoulder edge before going over and down {her} back. Only the front portion of the pallu near the collarbone and shoulder point is visible; the majority of the pallu length falls behind {her} shoulder and down {her} back, out of view from the front. The pleats must be clean, straight, and evenly spaced — like neatly pressed fabric folds, not bunched or crumpled.",
  },
  {
    id: "P2",
    title: "Three-quarter, hand on hip",
    summary: "Turned 30 degrees, pallu forward down the front so the full pattern reads.",
    live: true,
    order: ["opening", "blouse", "expression", "framing", "background", "styling", "lighting", "pose"],
    opening: (g, _p, subject, refs) =>
      `Using the exact ${g.type} fabric and print shown in the attached ${refs}, generate a professional fashion catalog photo of ${subject} wearing this ${g.type} exactly as shown, without altering, redesigning, or reinterpreting the fabric pattern, print, or colors in any way.`,
    blouse:
      "The blouse has short sleeves that end above the elbow, well before the elbow joint, exposing the forearm.",
    pose:
      "{She} stands at a slight three-quarter angle to the camera, shoulders and hips turned about 30 degrees away from straight-on, with {her} face turned back toward the camera. One hand rests lightly on {her} hip; the other arm hangs naturally at {her} side. The pallu is pleated neatly and draped over the left shoulder, falling forward along the front of {her} body so the full length of the pleats, pattern, and border are visible down to the hem. The pleats are clean, straight, and evenly spaced.",
  },
  {
    id: "P3",
    title: "Prompt 3",
    summary: "Not written yet.",
    live: false,
    order: [],
    opening: () => "",
    pose: "",
  },
  {
    id: "P4",
    title: "Prompt 4",
    summary: "Not written yet.",
    live: false,
    order: [],
    opening: () => "",
    pose: "",
  },
];

/** "cotton saree" — no article, so the caller can say "a" or "the". */
function garmentWords(g: GarmentWords): string {
  return [g.fibre, g.type].filter(Boolean).join(" ");
}

function fill(text: string, p: Pronouns): string {
  return text
    .replaceAll("{She}", p.She)
    .replaceAll("{she}", p.she)
    .replaceAll("{her}", p.her);
}

/** One attached file and which part of the garment it shows. */
export interface Attachment {
  slot: string;
  /** The filename the download gave it — `300021-body.png`. */
  file: string;
}

const PART_WORDS: Record<string, (type: string) => string> = {
  body: (t) => `the ${t} body — the main field and its repeating motif`,
  pallu: () => "the pallu — the decorated end that is draped over the shoulder",
  border: () => "the border — the narrow decorated strip that runs along the long edges and the hem",
  blouse: () => "the blouse piece — the fabric for the fitted top",
  "full-drape": (t) => `the whole ${t} laid out`,
  weave: () => "a close-up of the weave",
};

/**
 * Which image is which — and what to do about it.
 *
 * The first version named each file: "300021-body.png is the body". A chat
 * model is not shown filenames, so that told it nothing, and the first real
 * test came back with the style copied and every print invented. Two things
 * changed. The parts are now told apart by something the model can actually
 * see — position for separate files, a printed label for the sheet. And the
 * order to copy exactly comes before the instruction to make a photograph,
 * because a model does what it is told first.
 */
function legend(files: Attachment[], g: GarmentWords, mode: AttachMode): string {
  if (files.length === 0) return "";
  const describe = (slot: string) => (PART_WORDS[slot] ?? (() => slot))(g.type);

  const which =
    mode === "sheet"
      ? `The attached image is a sheet of ${files.length} labelled photographs of ONE ${g.type}. ` +
        files
          .map((f) => `The panel labelled ${f.slot.toUpperCase()} is ${describe(f.slot)}.`)
          .join(" ") +
        " Read the label printed above each panel to know which part it is. The panels keep their own proportions: the BORDER panel shows a narrow strip, and the border on the finished garment must stay that narrow."
      : `You are given ${files.length} reference photographs of ONE ${g.type}, attached in this order. ` +
        files.map((f, i) => `Image ${i + 1} is ${describe(f.slot)}.`).join(" ");

  const mandate = `Your task is to photograph THIS ${g.type} on a model — not to design a ${g.type} in this style. Reproduce each part exactly as photographed: the same motifs, the same colours, the same motif scale and spacing, the same border design and width. Where the body is visible it must show the body print. Where the pallu is visible it must show the pallu print. The border on the finished ${g.type} must be the border shown, at its real width. The blouse must be made of the blouse fabric. Do not invent motifs, do not substitute a generic print in the same style, and do not swap one part's design onto another.`;

  return `${which} ${mandate}`;
}

/**
 * The prompt for one template, given the product, the choices, and the files
 * that will be attached alongside it.
 */
export function composePrompt(
  template: PromptTemplate,
  garment: GarmentWords,
  s: Selections,
  files: Attachment[] = [],
): string {
  const p = PRONOUNS[s.modelType];
  const subject = `a ${p.noun} ${s.modelType === "girl" || s.modelType === "boy" ? s.age : `in ${p.her} ${s.age}`}`;
  const bg = BACKGROUNDS.find((b) => b.id === s.background) ?? BACKGROUNDS[0]!;
  const refs = s.attachMode === "sheet" ? "reference sheet" : "reference images";

  const parts: Record<Slot, string> = {
    opening: template.opening(garment, p, subject, refs),
    pose: fill(template.pose, p),
    blouse: template.blouse ?? "",
    expression: fill(EXPRESSION, p),
    framing: fill(FRAMING, p),
    background: fill(bg.scene, p),
    styling: styling(s.modelType),
    lighting: bg.lighting,
  };

  const body = template.order.map((slot) => parts[slot]).filter(Boolean).join(" ");
  const rules = SAFETY_RULES.filter((r) => s.rules[r.id]).map((r) => r.clause);

  // Legend first, so the model knows what it is looking at before it is told
  // what to do with it; rules last, as the standing constraints on the whole.
  return [legend(files, garment, s.attachMode), body, ...rules].filter(Boolean).join(" ");
}
