import { garment as garmentDef } from "./garments";
import { PLAYBOOK_PROMPTS } from "./playbook";
import { hasPallu } from "./poses";
import { scene as sceneDef } from "./scenes";
import { slot as slotDef, slotLabel } from "./slots";
import type { ModelBrief, Pose, RenderRequest } from "./types";

const DEFAULT_MODEL: Required<Omit<ModelBrief, "freeform">> = {
  age: "in her mid-20s",
  build: "of average height and build",
  complexion: "with a warm Indian complexion",
  hair: "with dark hair worn down",
  expression: "with a direct, confident gaze and a neutral-to-soft expression",
  styling: "gold jhumka earrings, a gold choker-style necklace, and bangles",
};

function describeModel(brief: ModelBrief | undefined): { who: string; styling: string } {
  const b = brief ?? {};
  if (b.freeform?.trim()) {
    return { who: b.freeform.trim(), styling: b.styling?.trim() || DEFAULT_MODEL.styling };
  }
  const who = [
    "a woman",
    b.age?.trim() || DEFAULT_MODEL.age,
    b.build?.trim() || DEFAULT_MODEL.build,
    b.complexion?.trim() || DEFAULT_MODEL.complexion,
    b.hair?.trim() || DEFAULT_MODEL.hair,
    b.expression?.trim() || DEFAULT_MODEL.expression,
  ].join(", ");
  return { who, styling: b.styling?.trim() || DEFAULT_MODEL.styling };
}

/**
 * Names every reference image by its role, in the order the provider will
 * receive them. This is the whole reason multi-slot capture is worth doing: an
 * unlabelled pile of photos makes the model guess which one is the pallu, and a
 * guess is where an invented motif comes from.
 */
export function referenceLegend(request: RenderRequest): string {
  const lines = request.references.map((ref, i) => {
    const def = slotDef(ref.slot);
    const note = ref.note?.trim() ? ` (${ref.note.trim()})` : "";
    return `Image ${i + 1} is ${def.describes}${note}.`;
  });
  if (request.mode === "person" && request.person) {
    lines.push(`Image ${request.references.length + 1} is the person who must be wearing the garment.`);
  }
  return lines.join(" ");
}

/**
 * The playbook's component legend: every photograph numbered, named in capitals,
 * and told where it sits on the body.
 *
 * This is the part of the Nano Banana prompt that does the real work — the
 * playbook's own claim is that naming an image is not enough, because the model
 * has no idea image 2 belongs over the left shoulder and will otherwise blend
 * the photographs into an invented pattern.
 *
 * Kept separate from the pose text so it can be put in front of a verbatim
 * playbook prompt, which never carried it: those five were written for pasting
 * into Gemini's web app, where they say "the reference image", singular.
 */
export function componentLegend(request: RenderRequest): string {
  const g = garmentDef(request.garment);
  const count = request.references.length;

  const lines = request.references.map((ref, i) => {
    const def = slotDef(ref.slot);
    const name = slotLabel(def, request.garment).toUpperCase();
    const note = ref.note?.trim() ? ` (${ref.note.trim()})` : "";
    const placement = def.placement ? ` ${def.placement}` : "";
    return `${i + 1}) ${name} — ${def.role ?? def.describes}${note}.${placement}`;
  });

  return [
    `You are a professional Indian fashion-catalogue photographer and virtual dresser. I am giving you ${count} photo${count === 1 ? "" : "s"} of the parts of ONE ${g.label.toLowerCase()}, in this order:`,
    "",
    lines.join("\n"),
    "",
    CLUTTER,
    "",
  ].join("\n");
}

/** Warehouse photographs have tags, hands and tables in them. */
const CLUTTER =
  "Ignore any shop background, price tags, labels, hands, or table surfaces in the reference photos — use only the garment fabric and its print.";

const FIDELITY =
  "Reproduce the garment exactly as photographed: the same colours, the same print, the same motifs at the same scale and spacing, the same borders and the same texture. Do not redesign, stylise, simplify, re-colour or reinterpret the pattern in any way, and do not invent motifs that are not present in the reference images. Where a part of the garment is folded away or not visible in the references, extrapolate it so that it is consistent with the parts that are visible.";

const NEGATIVE =
  "Photorealistic, high detail, sharp on the fabric. No text, no watermark, no logo, no collage, no border frame, and no additional people in the image.";

function subjectClause(request: RenderRequest, who: string): string {
  switch (request.mode) {
    case "mannequin":
      // The accuracy unlock: the drape in the photograph is physically real, so
      // the model must not re-derive it. It is doing a swap, not a render.
      return (
        "The reference photograph shows this garment really draped on a mannequin. " +
        `Replace only the mannequin with a real, living human model — ${who}. ` +
        "Keep every fold, pleat, tuck, border position and colour of the garment exactly as it appears in the photograph; do not re-drape, re-fold, re-pattern or re-light the garment itself. Only the mannequin becomes a person, and the surroundings are replaced as described below."
      );
    case "person":
      return (
        "Dress the person shown in the final reference image in this garment. " +
        "Preserve their face, skin tone, hair, body shape and proportions exactly as photographed — the person must remain recognisably themselves. Only the clothing changes."
      );
    case "describe":
    default:
      return `Generate a photorealistic fashion catalogue photograph of ${who} wearing this garment.`;
  }
}

/**
 * Builds the full prompt for one pose. Providers receive this ready to send.
 *
 * When the request asks for the playbook, the proven text is sent unchanged —
 * no legend, no scene, no model brief bolted on, because that prompt already
 * contains its own and mixing the two would test neither.
 */
export function composePrompt(request: RenderRequest, pose: Pose): string {
  const source = request.promptSource;

  if (source === "playbook" || source === "playbook-legend") {
    const verbatim = PLAYBOOK_PROMPTS[pose.id];
    // No playbook text for this pose — compose one rather than send nothing.
    if (verbatim) {
      return source === "playbook-legend"
        ? `${componentLegend(request)}\n${verbatim}`
        : verbatim;
    }
  }

  return composeFromFragments(request, pose);
}

function composeFromFragments(request: RenderRequest, pose: Pose): string {
  const g = garmentDef(request.garment);
  const s = sceneDef(request.scene);
  const { who, styling } = describeModel(request.model);

  const parts: string[] = [
    "You are a professional fashion catalogue photographer.",
    referenceLegend(request),
    `They are all photographs of ONE ${g.label.toLowerCase()}.`,
    subjectClause(request, who),
    FIDELITY,
  ];

  // A mannequin swap must not be told how to drape or how the blouse is cut —
  // both are already real in the photograph.
  if (request.mode !== "mannequin") {
    parts.push(g.drape);
    if (g.construction) parts.push(g.construction);
  }

  parts.push(pose.body);
  if (pose.drapeNote && hasPallu(request.garment)) parts.push(pose.drapeNote);

  parts.push(s.setting);
  if (s.light) parts.push(s.light);
  if (styling && request.mode !== "person") parts.push(`Styled with ${styling}.`);
  if (request.extraInstruction?.trim()) parts.push(request.extraInstruction.trim());
  parts.push(NEGATIVE);

  return parts.filter(Boolean).join(" ");
}
