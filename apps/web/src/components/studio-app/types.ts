import type { Garment, GarmentAnswers, GarmentPartRow, GenerationLook } from "@/db";

/** A garment as the browser sees it: no dates, nothing it cannot use. */
export interface GarmentView {
  id: string;
  title: string;
  productCode: string | null;
  source: string;
  garmentType: string;
  family: string;
  design: Record<string, string | null> | null;
  words: Record<string, string>;
  answers: GarmentAnswers & { borders?: boolean; bordersIdentical?: boolean };
  parts: GarmentPartRow[];
}

export function toView(garment: Garment): GarmentView {
  return {
    id: garment.id,
    title: garment.title,
    productCode: garment.productCode,
    source: garment.source,
    garmentType: garment.garmentType,
    family: garment.family,
    design: garment.design ?? null,
    words: garment.words,
    answers: garment.answers,
    parts: garment.parts,
  };
}

/** One run as the screens see it. */
export interface RunView {
  id: string;
  status: "running" | "done" | "failed" | "refused";
  imageUrl: string | null;
  error: string | null;
  ms: number | null;
  model: string;
  promptId: string;
  promptVersion: string;
  look: GenerationLook;
  verdict: "approved" | "rejected" | null;
  note: string;
  startedAt: string;
  clientKey: string;
  creditsPaise: number;
  garmentId?: string;
  garmentTitle?: string;
}

export type Screen =
  | "splash"
  | "entry"
  | "upload"
  | "shots"
  | "analyzing"
  | "confirm"
  | "flats"
  | "model"
  | "background"
  | "output"
  | "generating"
  | "result"
  | "poses"
  | "posesGenerating"
  | "gallery"
  | "myImages"
  | "profile"
  | "pricing";

/** Prompt → pose record, for the silhouette on the tile and the group it sits in. */
export const POSE_TILES: Record<string, { pose: string; silhouette: string | null; group: "front" | "side" | "back" | "garment" }> = {
  P1: { pose: "SAR-P01", silhouette: "/poses/saree/SAR-P01/silhouette.png", group: "front" },
  P2: { pose: "SAR-P04", silhouette: "/poses/saree/SAR-P04/silhouette.png", group: "side" },
  P3: { pose: "SAR-P08", silhouette: "/poses/saree/SAR-P08/silhouette.png", group: "back" },
  P4: { pose: "SAR-P30", silhouette: null, group: "garment" },
  P5: { pose: "SAR-P31", silhouette: null, group: "front" },
};

/** The first photograph made for a garment. Everything else is "more poses". */
export const PRIMARY_PROMPT = "P1";
