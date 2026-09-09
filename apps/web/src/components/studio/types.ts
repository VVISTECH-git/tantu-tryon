import type { ModelBrief } from "@tantu/engine/catalog";

/**
 * What the Studio is assembling.
 *
 * One object, built up a step at a time, complete enough to generate from only
 * when every step has been answered. Steps read and write this and nothing
 * else, so adding a step later does not mean threading a new prop through the
 * ones before it.
 */

export interface GarmentPart {
  /** `body` · `pallu` · `border` · `blouse` · `full-drape` · `weave` */
  slot: string;
  /** What to show a person: SLK's own label, or the file's name. */
  label: string;
  /** An https URL from SLK, or a data URL from an upload. */
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface ChosenProduct {
  /** SLK's product code, or null when the parts were uploaded by hand. */
  code: string | null;
  title: string;
  description: string | null;
  design: {
    code: string;
    name: string;
    colour: string | null;
    productType: string | null;
    motif: string | null;
    motifCategory: string | null;
  } | null;
  parts: GarmentPart[];
}

export interface StudioDraft {
  product: ChosenProduct | null;
  modelId: string;
  modelBrief: ModelBrief;
  /** Registry pose ids — `SAR-P15`. What a job records. */
  poseIds: string[];
  backdrop: string;
}

export const REQUIRED_SLOTS = ["body", "pallu", "border", "blouse"] as const;

export function missingSlots(product: ChosenProduct | null): string[] {
  if (!product) return [...REQUIRED_SLOTS];
  return REQUIRED_SLOTS.filter((slot) => !product.parts.some((p) => p.slot === slot));
}

export type StepId = "product" | "model" | "pose" | "review" | "result";

export interface Step {
  id: StepId;
  title: string;
  /** What this step is for, in the customer's terms rather than the system's. */
  hint: string;
}

export const STEPS: Step[] = [
  { id: "product", title: "Product", hint: "Which saree we are photographing" },
  { id: "model", title: "Model", hint: "Who wears it" },
  { id: "pose", title: "Pose", hint: "What she does" },
  { id: "review", title: "Review", hint: "What will be made, and what it costs" },
  { id: "result", title: "Result", hint: "The photographs" },
];
