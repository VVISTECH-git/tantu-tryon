import type { GarmentId, SlotId } from "./types";

export interface SlotDef {
  id: SlotId;
  label: string;
  /** Wording for garments where the default reads wrong — a shirt has no drape. */
  labelBy?: Partial<Record<GarmentId, string>>;
  /** Told to the model, verbatim, as what this image shows. */
  describes: string;
  /** What the person holding the camera should shoot. */
  hint: string;
  hintBy?: Partial<Record<GarmentId, string>>;
  garments: GarmentId[];
}

/** Garments that are draped rather than worn, where "full drape" is the right word. */
const DRAPED: GarmentId[] = ["saree", "lehenga", "dupatta"];

const EVERY_GARMENT: GarmentId[] = [
  "saree",
  "lehenga",
  "kurti",
  "salwar-suit",
  "blouse",
  "dupatta",
  "dress",
  "shirt",
  "fabric",
];

/**
 * The capture vocabulary. It matches the photo-guide slots already used on the
 * warehouse floor, so a shot taken on the phone arrives here already labelled
 * and never has to be re-identified by a human or guessed at by the model.
 *
 * Every garment must offer at least the slots its entry in garments.ts
 * recommends. Salwar suits, blouses and shirts previously offered none at all,
 * which left anyone choosing them with a board of one "Add more" tile.
 */
export const SLOTS: SlotDef[] = [
  {
    id: "full-drape",
    label: "Whole garment",
    labelBy: { saree: "Full drape", lehenga: "Full drape", dupatta: "Full drape" },
    describes: "the whole garment laid out or draped, showing its overall layout and proportions",
    hint: "The whole piece flat or on a stand, top-down, even light, no shadow across the fabric.",
    hintBy: {
      saree: "Whole saree flat or on a stand, top-down, even light, no shadow across the fabric.",
    },
    garments: EVERY_GARMENT,
  },
  {
    id: "pallu",
    label: "Pallu",
    describes: "the pallu — the decorated end that falls over the shoulder",
    hint: "Fill the frame with the pallu end. This is the part buyers judge first.",
    garments: ["saree", "dupatta"],
  },
  {
    id: "body",
    label: "Body",
    describes: "the body of the garment — the field and its repeating motif",
    hint: "A flat section of the main field, square to the camera, motif in focus.",
    garments: EVERY_GARMENT,
  },
  {
    id: "border",
    label: "Border",
    describes: "the border that runs along the edge and hem",
    hint: "A straight run of border, edge parallel to the frame.",
    garments: ["saree", "lehenga", "salwar-suit", "dupatta", "dress"],
  },
  {
    id: "blouse",
    label: "Blouse piece",
    describes: "the unstitched blouse piece supplied with the garment",
    hint: "The blouse piece flat and whole.",
    garments: ["saree", "lehenga"],
  },
  {
    id: "weave",
    label: "Weave detail",
    describes: "a macro detail of the weave, print or hand-painted line work",
    hint: "Close enough to read the brush or block work. Fixes motif drift more than any other shot.",
    garments: EVERY_GARMENT,
  },
  {
    id: "mannequin",
    label: "On a mannequin",
    describes: "the garment really draped on a mannequin, photographed as-is",
    hint: "Drape it for real, shoot it head to hem. The AI then only replaces the mannequin.",
    garments: ["saree", "lehenga", "kurti", "salwar-suit", "dress", "blouse", "shirt"],
  },
  {
    id: "extra",
    label: "Extra",
    describes: "an additional view of the same garment",
    hint: "Anything else worth showing.",
    garments: EVERY_GARMENT,
  },
];

const BY_ID = new Map(SLOTS.map((s) => [s.id, s]));

export function slot(id: SlotId): SlotDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown slot: ${id}`);
  return found;
}

export function slotsFor(garment: GarmentId): SlotDef[] {
  return SLOTS.filter((s) => s.garments.includes(garment));
}

/** The tile's caption, in wording that suits the garment in hand. */
export function slotLabel(def: SlotDef, garment: GarmentId): string {
  return def.labelBy?.[garment] ?? def.label;
}

export function slotHint(def: SlotDef, garment: GarmentId): string {
  return def.hintBy?.[garment] ?? def.hint;
}

export function isDraped(garment: GarmentId): boolean {
  return DRAPED.includes(garment);
}
