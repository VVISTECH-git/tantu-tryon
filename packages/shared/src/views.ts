/**
 * What the server sends to a client, web or phone. No dates it cannot use,
 * no database types. The server builds these from its rows; the clients
 * only read them.
 */

/** What the free check at upload made of one photograph. */
export interface PartQuality {
  /** ok · warn · block — block means the tile asks for a retake before Generate. */
  status: "ok" | "warn" | "block";
  reasons: { code: string; level: "warn" | "block"; message: string }[];
  metrics: { sharpness: number; brightness: number; dark: number; bright: number; width: number; height: number };
}

export interface GarmentPartView {
  /** body · pallu · border · blouse · body_motif · pallu_motif · whole · saree (one flat photo) */
  slot: string;
  key: string | null;
  url: string;
  width: number | null;
  height: number | null;
  rotate: 0 | 90 | 180 | 270;
  quality?: PartQuality;
}

export interface GarmentAnswersView {
  blouseSameAsBody?: boolean;
  palluDistinct?: boolean;
  borders?: boolean;
  bordersIdentical?: boolean;
}

export interface GarmentView {
  id: string;
  title: string;
  productCode: string | null;
  source: string;
  garmentType: string;
  family: string;
  design: Record<string, string | null> | null;
  words: Record<string, string>;
  answers: GarmentAnswersView;
  parts: GarmentPartView[];
}

export interface UploadResult {
  garment: GarmentView;
  quality: PartQuality;
  /** Required slots still missing or blocked. */
  missing: string[];
}

export interface GenerationLookView {
  modelType: string;
  age: string;
  background: string;
  quality: "standard" | "high";
}

export interface RunView {
  id: string;
  status: "running" | "done" | "failed" | "refused";
  imageUrl: string | null;
  error: string | null;
  ms: number | null;
  model: string;
  promptId: string;
  promptVersion: string;
  look: GenerationLookView;
  verdict: "approved" | "rejected" | null;
  note: string;
  startedAt: string;
  clientKey: string;
  creditsPaise: number;
  garmentId?: string;
  garmentTitle?: string;
}

/** The default look every saree is shot with until men and children come back. */
export const DEFAULT_LOOK: GenerationLookView = { modelType: "woman", age: "late 20s", background: "courtyard", quality: "standard" };
export const PRIMARY_PROMPT = "P1";
