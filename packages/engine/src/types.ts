// The vocabulary the whole engine speaks. Nothing in here imports a framework,
// so the same types serve the web app today and a queue worker later.

/**
 * A reference photograph's role in the garment. This is the single thing the
 * competition does not have: they take one flat garment photo, so the model has
 * to guess what the pallu looks like. We tell it.
 */
export type SlotId =
  | "full-drape"
  | "pallu"
  | "body"
  | "border"
  | "blouse"
  | "weave"
  | "mannequin"
  | "extra";

/** Image payload is RAW base64 — no `data:` prefix — everywhere in the engine. */
export interface Reference {
  slot: SlotId;
  data: string;
  /** Sniffed from the payload when omitted. */
  mime?: string;
  /** Free text shown to the model, e.g. "gold zari, not yellow". */
  note?: string;
}

export type GarmentId =
  | "saree"
  | "lehenga"
  | "kurti"
  | "salwar-suit"
  | "blouse"
  | "dupatta"
  | "dress"
  | "shirt"
  | "fabric";

/**
 * How the wearer comes into being.
 * - `describe` — no person photo at all; the model is invented from a brief.
 * - `mannequin` — the garment was really draped on a mannequin and photographed;
 *   the AI swaps only the mannequin for a person. Highest fidelity, because the
 *   drape is physically real and never gets re-imagined.
 * - `person`   — a specific person's photo; the garment goes onto them.
 */
export type RenderMode = "describe" | "mannequin" | "person";

export type ProviderId = "gemini" | "fal" | "fashn";

/** Who the invented model is. Every field optional — defaults are sensible. */
export interface ModelBrief {
  /** Free-text override. When set, the structured fields below are ignored. */
  freeform?: string;
  age?: string;
  build?: string;
  complexion?: string;
  hair?: string;
  expression?: string;
  /** Jewellery and accessories. */
  styling?: string;
}

export interface RenderRequest {
  garment: GarmentId;
  mode: RenderMode;
  /** At least one. For `mannequin` mode, include the mannequin shot. */
  references: Reference[];
  /** Required when mode is `person`. */
  person?: Reference;
  model?: ModelBrief;
  /** A scene preset id, or free text describing the setting. */
  scene?: string;
  /** Which poses to render. One output image per pose. */
  poses: string[];
  /** Appended verbatim to every composed prompt. */
  extraInstruction?: string;
  /**
   * `standard` is the cheap fast image model; `high` is the expensive one worth
   * spending on a hero shot or a motif that keeps drifting.
   */
  quality?: "standard" | "high";
  /**
   * Which prompt to send.
   *
   * `composed` builds one from the fragments — garment, pose, scene, model.
   * `playbook` sends the Saree Generation Playbook's pose prompt unchanged,
   * ignoring the scene and model settings because that text already carries
   * its own. It exists so the composed prompt can be judged against the wording
   * that was actually proven on kalamkari, from the same photographs.
   */
  promptSource?: "composed" | "playbook";
}

export interface Pose {
  id: string;
  name: string;
  /** Which garments this pose is offered for. Omitted = all of them. */
  garments?: GarmentId[];
  /** Stance, hands and framing. Garment-neutral. */
  body: string;
  /**
   * How the pallu behaves in this particular pose. Only applied to garments
   * that have one — it is the difference between a saree that reads as draped
   * and one that reads as a printed sheet.
   */
  drapeNote?: string;
}

export interface Scene {
  id: string;
  name: string;
  setting: string;
  light: string;
}

/** What a provider hands back for one pose. */
export interface ProviderImage {
  data: string;
  mime: string;
  /** The provider's own model identifier, for the audit trail. */
  model: string;
}

export interface RenderJobInput {
  request: RenderRequest;
  pose: Pose;
  /** Fully composed. Providers that cannot take a prompt may ignore it. */
  prompt: string;
  /** Aborts the in-flight call when the caller gives up, so Stop stops paying. */
  signal?: AbortSignal;
}

export interface TryOnProvider {
  id: ProviderId;
  label: string;
  /** False for engines that can only dress a supplied person photo. */
  supports(mode: RenderMode): boolean;
  render(input: RenderJobInput): Promise<ProviderImage>;
}

/** One finished pose, successful or not. A failed pose never fails the batch. */
export type RenderOutcome =
  | {
      ok: true;
      poseId: string;
      poseName: string;
      data: string;
      mime: string;
      prompt: string;
      provider: ProviderId;
      model: string;
      ms: number;
    }
  | {
      ok: false;
      poseId: string;
      poseName: string;
      prompt: string;
      provider: ProviderId;
      error: string;
      ms: number;
    };

export interface RenderReport {
  outcomes: RenderOutcome[];
  succeeded: number;
  failed: number;
  ms: number;
}
