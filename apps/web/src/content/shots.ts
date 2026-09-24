/**
 * What to photograph, per garment type.
 *
 * The shop hangs a saree once on a rod, with the body–pallu join at chest
 * height, and never touches it again: only the phone moves. Each shot says
 * where to stand, how high to hold the phone, and which way to hold it, so
 * someone who has never done it can follow the tiles without reading much.
 *
 * Shared by the web studio and, later, the native app: nothing here knows
 * about React or the database.
 */

export type Orientation = "upright" | "sideways";

export type GarmentFamily = "unstitched" | "stitched_top" | "bottom" | "set";

export interface Shot {
  /** The part slot the photograph lands in. */
  slot: string;
  label: string;
  required: boolean;
  orientation: Orientation;
  /** One line under the label: where to stand and how high to hold the phone. */
  where: string;
  /** The longer "How" text, read from the tile's How link. */
  how: string;
}

export interface GarmentTypeOption {
  value: string;
  label: string;
  group: "Women" | "Men" | "Kids";
  family: GarmentFamily;
  /** Only types with a proven prompt are live; the rest show as "Soon". */
  enabled: boolean;
}

export const GARMENT_TYPES: GarmentTypeOption[] = [
  { value: "saree", label: "Saree", group: "Women", family: "unstitched", enabled: true },
  { value: "stitched_kurta", label: "Women's Stitched Kurta", group: "Women", family: "stitched_top", enabled: false },
  { value: "unstitched_kurta", label: "Women's Unstitched Kurta", group: "Women", family: "unstitched", enabled: false },
  { value: "womens_dress", label: "Women's Western Dress", group: "Women", family: "stitched_top", enabled: false },
  { value: "womens_top", label: "Women's Top", group: "Women", family: "stitched_top", enabled: false },
  { value: "womens_tee", label: "Women's Tee", group: "Women", family: "stitched_top", enabled: false },
  { value: "womens_bra", label: "Women's Bra", group: "Women", family: "stitched_top", enabled: false },
  { value: "womens_briefs", label: "Women's Briefs", group: "Women", family: "bottom", enabled: false },
  { value: "womens_sleepwear", label: "Women's Sleepwear", group: "Women", family: "set", enabled: false },
  { value: "womens_lehenga", label: "Women's Lehenga / Indian Bridal", group: "Women", family: "set", enabled: false },
  { value: "mens_tee", label: "Men's Tee", group: "Men", family: "stitched_top", enabled: false },
  { value: "mens_shirt", label: "Men's Shirt", group: "Men", family: "stitched_top", enabled: false },
  { value: "mens_kurta", label: "Men's Kurta", group: "Men", family: "stitched_top", enabled: false },
  { value: "kids_western_wear", label: "Kids Western Wear", group: "Kids", family: "set", enabled: false },
  { value: "kids_indian_ethnic", label: "Kids Indian Ethnic", group: "Kids", family: "set", enabled: false },
];

export const DEFAULT_GARMENT_TYPE = "saree";

export function garmentType(value: string | null | undefined): GarmentTypeOption {
  return GARMENT_TYPES.find((t) => t.value === value) ?? GARMENT_TYPES[0]!;
}

export function garmentTypeGroups(): Record<GarmentTypeOption["group"], GarmentTypeOption[]> {
  const groups: Record<GarmentTypeOption["group"], GarmentTypeOption[]> = { Women: [], Men: [], Kids: [] };
  for (const t of GARMENT_TYPES) groups[t.group].push(t);
  return groups;
}

/** The saree, hung once on the rod. Order is the order the tiles show in. */
export const SAREE_SHOTS: Shot[] = [
  {
    slot: "body",
    label: "Body",
    required: true,
    orientation: "upright",
    where: "Eye level, one big step back, one border in the frame",
    how: "Hold the phone upright. Stand one big step back from the rod, phone at eye level, pointing straight ahead. The part above the join fills the frame, with one border running along the edge.",
  },
  {
    slot: "pallu",
    label: "Pallu",
    required: true,
    orientation: "sideways",
    where: "Waist height, the join at the top of the frame",
    how: "Turn the phone sideways. Stand in the same spot, phone at waist height, pointing straight ahead. The line where the pallu meets the body sits at the top of the frame and the brocade fills the rest.",
  },
  {
    slot: "border",
    label: "Border",
    required: false,
    orientation: "upright",
    where: "Step in to half a metre, border running up the frame",
    how: "Hold the phone upright. Step in to about half a metre at chest height. The border runs top to bottom through the frame with a hand's width of body beside it. Any point along the length will do.",
  },
  {
    slot: "blouse",
    label: "Blouse piece",
    required: false,
    orientation: "sideways",
    where: "Knee height, the plain end filling the frame",
    how: "Turn the phone sideways. Same spot, phone at knee height or crouch. The plain blouse end at the bottom fills the frame. Skip this if the saree has no separate blouse piece.",
  },
  {
    slot: "body_motif",
    label: "Body motif",
    required: false,
    orientation: "upright",
    where: "Close up, one figure or three repeats fill the frame",
    how: "Hold the phone upright. Step in close at eye level so one motif or figure fills the frame, sharp. For a small repeating butta, get three or four repeats in so the spacing shows.",
  },
  {
    slot: "pallu_motif",
    label: "Pallu motif",
    required: false,
    orientation: "sideways",
    where: "Close up, one band of the brocade",
    how: "Turn the phone sideways. Step in close at waist height so the main pallu motif or one full band of the brocade fills the frame.",
  },
  {
    slot: "whole",
    label: "Whole saree",
    required: false,
    orientation: "upright",
    where: "From the aisle, as far back as you can; angle is fine",
    how: "Hold the phone upright. Stand as far back as the aisle allows and get the whole hang in, rod to floor. Shooting from below is fine for this one; it only shows how the parts sit together.",
  },
];

/** The shots for a garment type. Only the saree has a list today. */
export function shotsFor(type: string): Shot[] {
  return garmentType(type).value === "saree" ? SAREE_SHOTS : [];
}

export function shotFor(type: string, slot: string): Shot | undefined {
  return shotsFor(type).find((s) => s.slot === slot);
}

export function requiredSlots(type: string): string[] {
  return shotsFor(type)
    .filter((s) => s.required)
    .map((s) => s.slot);
}

/**
 * Which four photographs go on the labelled sheet.
 *
 * The frozen prompts were proven on a four-cell sheet, so the sheet stays at
 * four. Body, pallu and border always lead; the last cell goes to the first
 * of these that exists: a contrast blouse piece, the pallu motif, the body
 * motif, the whole hang. A missing border frees its cell to the same list.
 */
export const SHEET_LEAD = ["body", "pallu", "border"] as const;
export const SHEET_FILL = ["blouse", "pallu_motif", "body_motif", "whole"] as const;
export const SHEET_CELLS = 4;
