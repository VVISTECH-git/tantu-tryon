import type { GarmentId } from "./types";

export interface GarmentDef {
  id: GarmentId;
  label: string;
  /** How the garment must sit on the body. The hardest part for a saree. */
  drape: string;
  /** Slots that materially improve fidelity for this garment. */
  recommendedSlots: string[];
}

export const GARMENTS: GarmentDef[] = [
  {
    id: "saree",
    label: "Saree",
    drape:
      "Drape it as a traditional Indian saree: neat, evenly spaced pleats tucked at the waist, the pleated pallu falling over the left shoulder, and the decorative border running correctly along the hem and down the pallu edge. The pleats must read as pressed fabric folds — straight and evenly spaced, never bunched or crumpled.",
    recommendedSlots: ["full-drape", "pallu", "body", "border", "blouse"],
  },
  {
    id: "lehenga",
    label: "Lehenga",
    drape:
      "Style it as a lehenga: the flared skirt falling in even panels from the waist, the blouse fitted, and the dupatta draped over one shoulder so its border stays visible.",
    recommendedSlots: ["full-drape", "body", "border", "blouse"],
  },
  {
    id: "kurti",
    label: "Kurti",
    drape:
      "Style it as a kurti worn straight on the body, side seams hanging clean, the neckline and hem detail clearly visible.",
    recommendedSlots: ["full-drape", "body", "weave"],
  },
  {
    id: "salwar-suit",
    label: "Salwar suit",
    drape:
      "Style it as a salwar suit: kurta over matching bottoms, with the dupatta draped across the front or over one shoulder.",
    recommendedSlots: ["full-drape", "body", "border"],
  },
  {
    id: "blouse",
    label: "Blouse",
    drape: "Style it as a fitted blouse, with the neckline, sleeve length and back detail readable.",
    recommendedSlots: ["full-drape", "body", "weave"],
  },
  {
    id: "dupatta",
    label: "Dupatta",
    drape:
      "Drape it as a dupatta over a plain, unpatterned outfit so nothing competes with it, with its border and end panels visible.",
    recommendedSlots: ["full-drape", "pallu", "border", "weave"],
  },
  {
    id: "dress",
    label: "Dress",
    drape: "Style it as a dress falling naturally from the shoulders, seams and hem sitting correctly.",
    recommendedSlots: ["full-drape", "body"],
  },
  {
    id: "shirt",
    label: "Shirt",
    drape: "Style it as a shirt worn tucked, collar and cuffs sitting correctly.",
    recommendedSlots: ["full-drape", "body"],
  },
  {
    id: "fabric",
    label: "Fabric only",
    drape:
      "The reference is loose yardage, not a finished garment. Construct a plausible, well-cut garment from this exact fabric without altering its print, scale or colour.",
    recommendedSlots: ["body", "weave"],
  },
];

const BY_ID = new Map(GARMENTS.map((g) => [g.id, g]));

export function garment(id: GarmentId): GarmentDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown garment: ${id}`);
  return found;
}
