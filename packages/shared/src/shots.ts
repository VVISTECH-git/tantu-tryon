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
  /** The sample photograph of this shot, cut from the shop's own rod photographs. */
  sample: string;
  /** The framing diagram, when the shot has one: where the frame goes on the saree. */
  frame?: string;
  /** What each thing inside the frame tells us; shown on the How sheet. */
  gives?: string;
}

/** Where the saree samples live; `avoid_*` are the "do not do this" examples. */
export const SAREE_SAMPLE = (name: string) => `/shots/saree/${name}.jpg`;

export interface GarmentTypeOption {
  value: string;
  label: string;
  group: "Women" | "Men" | "Kids";
  family: GarmentFamily;
  /** Only types with a proven prompt are live; the rest show as "Soon". */
  enabled: boolean;
}

// The user's list (7 Oct): only what the shop and its supplier sell. All live since the Qwen track (8 Oct).
export const GARMENT_TYPES: GarmentTypeOption[] = [
  { value: "saree", label: "Saree", group: "Women", family: "unstitched", enabled: true },
  { value: "kurti", label: "Kurti / Kurta", group: "Women", family: "stitched_top", enabled: true },
  { value: "frock", label: "Frock / Anarkali", group: "Women", family: "stitched_top", enabled: true },
  { value: "blouse", label: "Blouse", group: "Women", family: "stitched_top", enabled: true },
  { value: "coord_set", label: "Co-ord set (kurti + pant)", group: "Women", family: "set", enabled: true },
  { value: "lehenga", label: "Lehenga / Top & skirt", group: "Women", family: "set", enabled: true },
  { value: "dupatta", label: "Dupatta", group: "Women", family: "unstitched", enabled: true },
  // 30 Oct, user: aartisanz sells these too; the photographer shoots them like a dupatta.
  { value: "stole", label: "Stole", group: "Women", family: "unstitched", enabled: true },
  { value: "scarf", label: "Scarf", group: "Women", family: "unstitched", enabled: true },
];

export const DEFAULT_GARMENT_TYPE = "saree";

export function garmentType(value: string | null | undefined): GarmentTypeOption {
  return GARMENT_TYPES.find((t) => t.value === value) ?? GARMENT_TYPES[0]!;
}

export function garmentTypeGroups(): Record<GarmentTypeOption["group"], GarmentTypeOption[]> {
  const groups: Record<GarmentTypeOption["group"], GarmentTypeOption[]> = { Women: [], Men: [], Kids: [] };
  for (const t of GARMENT_TYPES) groups[t.group].push(t);
  // A group with nothing in it would show as an empty heading in the picker.
  for (const g of Object.keys(groups) as GarmentTypeOption["group"][]) if (groups[g].length === 0) delete groups[g];
  return groups;
}

/** The saree, hung once on the rod. Order is the order the tiles show in. */
export const SAREE_SHOTS: Shot[] = [
  {
    slot: "body",
    sample: SAREE_SAMPLE("body"),
    frame: SAREE_SAMPLE("frame_body"),
    label: "Body",
    required: true,
    orientation: "upright",
    where: "Eye level, both borders in, edge to edge",
    how: "Hold the phone upright. Stand a step and a half back from the rod, phone at eye level, pointing straight ahead. Both borders inside the frame, edge to edge, with two or three full repeats of the motif. Stop above the join: no pallu in this frame.",
    gives: "This one photo gives the body print, the top border and the bottom border, and whether the two borders differ.",
  },
  {
    slot: "pallu",
    sample: SAREE_SAMPLE("pallu"),
    frame: SAREE_SAMPLE("frame_pallu"),
    label: "Pallu",
    required: false,
    orientation: "upright",
    where: "Waist height, a band of body at the top, the end edge at the bottom",
    how: "Hold the phone upright. Same spot, phone at waist height, pointing straight ahead. A thin band of body at the top of the frame, both borders inside, and the end edge of the pallu at the bottom.",
    gives: "Skip this if the saree looks the same from end to end — the body photo stands in for the pallu too. Take it whenever the pallu carries its own design.",
  },
  {
    slot: "border",
    sample: SAREE_SAMPLE("border"),
    frame: SAREE_SAMPLE("frame_border"),
    label: "Border",
    required: false,
    orientation: "upright",
    where: "Only if the border has a design of its own. Half a metre, at the side",
    how: "Hold the phone upright. Stand at the side of the saree, half a metre from the fabric, chest height, straight on. The border runs top to bottom through the middle of the frame and takes about a third of it: the fabric's outer edge on one side, a hand's width of body on the other, two or three full repeats of the border motif. If the two borders differ, shoot the wider one.",
    gives: "Without this, the border is cut from the edges of the body photo. That is enough for a plain or zari-line border; take this when the border has figures of its own.",
  },
  {
    slot: "blouse",
    sample: SAREE_SAMPLE("blouse"),
    label: "Blouse piece",
    required: false,
    orientation: "sideways",
    where: "Knee height, the plain end filling the frame",
    how: "Turn the phone sideways. Same spot, phone at knee height or crouch. The plain blouse end at the bottom fills the frame. Skip this if the saree has no separate blouse piece.",
  },
  {
    slot: "body_motif",
    sample: SAREE_SAMPLE("body_motif"),
    label: "Body motif",
    required: false,
    orientation: "upright",
    where: "Close up, one figure or three repeats fill the frame",
    how: "Hold the phone upright. Step in close at eye level so one motif or figure fills the frame, sharp. For a small repeating butta, get three or four repeats in so the spacing shows.",
  },
  {
    slot: "pallu_motif",
    sample: SAREE_SAMPLE("pallu_motif"),
    label: "Pallu motif",
    required: false,
    orientation: "sideways",
    where: "Close up, one band of the brocade",
    how: "Turn the phone sideways. Step in close at waist height so the main pallu motif or one full band of the brocade fills the frame.",
  },
  {
    slot: "whole",
    sample: SAREE_SAMPLE("whole"),
    label: "Whole saree",
    required: false,
    orientation: "upright",
    where: "From the aisle, as far back as you can; angle is fine",
    how: "Hold the phone upright. Stand as far back as the aisle allows and get the whole hang in, rod to floor. Shooting from below is fine for this one; it only shows how the parts sit together.",
  },
];

/**
 * Stitched garments and dupattas (8 Oct): one photo of the whole piece is
 * enough for the model; a close-up of the print helps it keep the motif true.
 */
export const GARMENT_SHOTS: Shot[] = [
  {
    slot: "whole",
    sample: "/shots/garment/whole.jpg",
    label: "The garment",
    required: true,
    orientation: "upright",
    where: "The whole piece in frame, front on, nothing cut off",
    how: "Hold the phone upright. On a hanger, a mannequin or laid flat: the whole garment from top to hem inside the frame, straight on, in even light. Plain background if you can; the model removes hangers and stands anyway.",
    gives: "This one photo gives the cut, the print and the colours.",
  },
  {
    slot: "body_motif",
    sample: "/shots/garment/motif.jpg",
    label: "Print close-up",
    required: false,
    orientation: "upright",
    where: "Close, one motif or a few repeats sharp in frame",
    how: "Step in close so one motif, or three or four repeats of a small print, fill the frame, sharp.",
    gives: "Keeps the motif's shape and colours exact in the result.",
  },
];

/**
 * The photographer's lists (30 Oct, agreed with the user product by product).
 *
 * Every shot here must be taken: the phone's photographer login cannot finish
 * a product without all of them. They cover the AI's inputs and the photos the
 * shop shows customers (close-ups, mannequin, floor, folded). The web studio
 * keeps its shorter lists above; making a model image still needs only
 * `generateSlots`.
 */
const take = (slot: string, label: string, where: string, how: string, sample = "", orientation: Orientation = "upright"): Shot => ({
  slot, label, required: true, orientation, where, how, sample,
});

const FRONT = take("whole", "Front", "On a mannequin, front on, the whole piece in frame", "Dress the mannequin and stand back so the whole garment, neck to hem, fills the frame, straight on, in even light. Nothing cut off.", "/shots/garment/whole.jpg");
const BACK = take("back", "Back", "On a mannequin, from behind, the whole piece in frame", "Turn the mannequin round. The whole back, neck to hem, straight on, so the back neck, ties, zip or buttons show.");
const PRINT = take("body_motif", "Print close-up", "Close, one motif or a few repeats sharp", "Step in close so one motif, or three or four repeats of a small print, fill the frame, sharp.", "/shots/garment/motif.jpg");
const NECK = take("neck", "Neck close-up", "Close, the neckline filling the frame", "On the mannequin, step in close so the whole neckline and its edging fill the frame, front on.");
const SLEEVE = take("sleeve", "Sleeve close-up", "Close, one sleeve from shoulder to cuff", "On the mannequin, one sleeve from the shoulder seam to the cuff or hem, so its length and finish show.");
const FASTENING = take("fastening", "Fastening", "Close, where it buttons, hooks or zips", "Close up on where the garment opens and closes: buttons, hooks, zip or ties, front or back, whichever side has them.");
const WAIST = take("waist", "Waist close-up", "Close, the waistband of the skirt or pants", "Close up on the waistband so it shows how it closes: button, elastic, drawstring or zip.");
const FABRIC = take("fabric", "Fabric close-up", "Very close, the weave and texture", "Get very close to a flat part of the fabric so the weave and texture are sharp.");
const ZARI = take("zari", "Zari close-up", "Close, the zari or thread work", "Close up on the zari or thread work of the border, sharp, in even light so the shine shows.");
const TASSELS = take("tassels", "Tassels", "The finished end with its tassels", "Lay the end flat or let it hang, and get the tassels and the end finish in the frame.");
const MANNEQUIN = take("mannequin", "Mannequin", "Draped on a mannequin, the whole drape in frame", "Drape it on the mannequin the way it is worn and stand back so the whole drape is in the frame.");
const FLOOR = take("floor", "Floor", "Laid out on the floor or a mat, seen from above", "Spread it on a clean floor or mat and shoot from above so the whole piece shows.");
const FOLDED = take("folded", "Folded", "Folded the way it ships", "Fold it neatly the way it goes to the customer and shoot it from above.");
const BODY = take("body", "Body", "Flat and straight, the main print", "Spread it flat and straight, phone square to the cloth, so the main print shows with no folds.");
const BORDER = take("border", "Border", "Flat, the edge design running through the frame", "Close enough that the border design fills about a third of the frame, flat and straight.");
const END = take("end", "End", "Flat, the decorated end panel", "Spread the decorated end panel flat and straight so the whole panel is in the frame.");

const KURTI_SAMPLES: Shot[] = [
  { ...FRONT, sample: "/shots/kurti/front.jpg" },
  { ...BACK, sample: "/shots/kurti/back.jpg" },
  { ...PRINT, sample: "/shots/kurti/print.jpg" },
  { ...NECK, sample: "/shots/kurti/neck.jpg" },
  { ...SLEEVE, sample: "/shots/kurti/sleeve.jpg" },
];

export const CAPTURE_SHOTS: Record<string, Shot[]> = {
  saree: [
    { ...SAREE_SHOTS[0]!, required: true },
    { ...SAREE_SHOTS[1]!, required: true },
    { ...SAREE_SHOTS[2]!, required: true, where: "Half a metre, at the side, the border through the middle" },
    { ...SAREE_SHOTS[3]!, required: true, where: "Knee height, the blouse piece filling the frame" },
    FABRIC, ZARI, TASSELS, MANNEQUIN, FLOOR, FOLDED,
  ],
  // Samples (30 Oct): Durga Rao's elephant dupatta made flat and the other views in Gemini from his photo;
  // zari and tassels from a Mangalagiri dupatta on iTokri (his has neither).
  dupatta: [
    { ...BODY, sample: "/shots/dupatta/body.jpg" },
    { ...BORDER, sample: "/shots/dupatta/border.jpg" },
    { ...END, sample: "/shots/dupatta/end.jpg" },
    { ...FABRIC, sample: "/shots/dupatta/fabric.jpg" },
    { ...ZARI, sample: "/shots/dupatta/zari.jpg" },
    { ...TASSELS, sample: "/shots/dupatta/tassels.jpg" },
    { ...MANNEQUIN, sample: "/shots/dupatta/mannequin.jpg" },
    { ...FLOOR, sample: "/shots/dupatta/floor.jpg" },
    { ...FOLDED, sample: "/shots/dupatta/folded.jpg" },
  ],
  // 30 Oct: no Border for a stole (its side border is a thin line; the End shows the decoration).
  // Samples: one Pedana block-print stole; body and end made in Gemini from its photos.
  stole: [
    { ...BODY, sample: "/shots/stole/body.jpg" },
    { ...END, sample: "/shots/stole/end.jpg" },
    { ...FABRIC, sample: "/shots/stole/fabric.jpg" },
    { ...MANNEQUIN, where: "Around the mannequin's neck, both ends hanging", sample: "/shots/stole/mannequin.jpg" },
    take("ends", "Ends close-up", "The two ends hanging side by side", "With the stole on the mannequin, get both decorated ends side by side in the frame.", "/shots/stole/ends.jpg"),
  ],
  // Samples (30 Oct): one Pedana block-print scarf; body and border made in Gemini from its photos.
  scarf: [
    { ...BODY, where: "Flat, the whole square", sample: "/shots/scarf/body.jpg" },
    { ...BORDER, sample: "/shots/scarf/border.jpg" },
    { ...FABRIC, sample: "/shots/scarf/fabric.jpg" },
    { ...MANNEQUIN, where: "Tied around the mannequin's neck", sample: "/shots/scarf/mannequin.jpg" },
    take("hanging", "Hanging", "Hung from one corner on a string or rod", "Hang the scarf from one corner so the print and border fall open, and get the whole of it in the frame.", "/shots/scarf/hanging.jpg"),
  ],
  // Samples (30 Oct): Durga Rao's Kalamkari cotton kurti; back, neck and sleeve made in Gemini from its
  // photo. The frock shows the same kurti until it has its own.
  kurti: KURTI_SAMPLES,
  frock: KURTI_SAMPLES,
  // Samples (30 Oct): Durga Rao's block-print blouse, cleaned and put on a mannequin in Gemini from his photo.
  blouse: [
    { ...FRONT, sample: "/shots/blouse/front.jpg" },
    { ...BACK, sample: "/shots/blouse/back.jpg" },
    { ...FASTENING, sample: "/shots/blouse/fastening.jpg" },
    { ...PRINT, sample: "/shots/blouse/print.jpg" },
    { ...NECK, sample: "/shots/blouse/neck.jpg" },
    { ...SLEEVE, sample: "/shots/blouse/sleeve.jpg" },
  ],
  // Samples (30 Oct): Durga Rao's block-print co-ord set, background cleaned and views made in Gemini from his photo.
  coord_set: [
    { ...FRONT, sample: "/shots/coord/front.jpg" },
    { ...BACK, sample: "/shots/coord/back.jpg" },
    { ...WAIST, sample: "/shots/coord/waist.jpg" },
    { ...PRINT, sample: "/shots/coord/print.jpg" },
    { ...NECK, sample: "/shots/coord/neck.jpg" },
    { ...SLEEVE, sample: "/shots/coord/sleeve.jpg" },
  ],
  // Samples (30 Oct): Durga Rao's Kalamkari top and pleated skirt, cleaned and views made in Gemini from his photo.
  lehenga: [
    { ...FRONT, sample: "/shots/topskirt/front.jpg" },
    { ...BACK, sample: "/shots/topskirt/back.jpg" },
    { ...WAIST, sample: "/shots/topskirt/waist.jpg" },
    { ...PRINT, sample: "/shots/topskirt/print.jpg" },
    { ...NECK, sample: "/shots/topskirt/neck.jpg" },
    { ...SLEEVE, sample: "/shots/topskirt/sleeve.jpg" },
  ],
};

/** The photographer's list for a garment type: every shot required. */
export function captureShotsFor(type: string): Shot[] {
  return CAPTURE_SHOTS[garmentType(type).value] ?? shotsFor(type);
}

/**
 * The phone's tiles for a product: the photographer's list, then any photo
 * already taken under the studio's older list (a saree's body motif or whole
 * hang from before 30 Oct), so it stays visible and removable. Those are optional.
 */
export function captureShotsWith(type: string, has: (slot: string) => boolean): Shot[] {
  const list = captureShotsFor(type);
  const older = shotsFor(type).filter((s) => !list.some((c) => c.slot === s.slot) && has(s.slot));
  return [...list, ...older.map((s) => ({ ...s, required: false }))];
}

/** The tag photo kept when a tag is scanned (30 Oct); never one of the tiles. */
const TAG_SHOT: Shot = { slot: "tag", label: "Tag", required: false, orientation: "upright", where: "", how: "", sample: "" };

/** The least a model image needs: the old required shots (saree: body; stitched: the front; dupatta, stole, scarf: body). */
export function generateSlots(type: string): string[] {
  const v = garmentType(type).value;
  return v === "dupatta" || v === "stole" || v === "scarf" ? ["body"] : requiredSlots(v);
}

/**
 * The shots still missing before a model image can be made, given what is
 * there. A product is ready when either list is complete: the studio's (a
 * dupatta photographed whole on the web) or the photographer's minimum (its body).
 */
export function missingForGenerate(type: string, has: (slot: string) => boolean): string[] {
  const lists = [requiredSlots(type), generateSlots(type)].map((l) => l.filter((slot) => !has(slot)));
  // On a tie the photographer's minimum wins, so the message names a shot on the phone's list ("Body", not "The garment").
  return lists.reduce((a, b) => (b.length <= a.length ? b : a));
}

/** The shots for a garment type: the saree's own list, or the plain one for everything stitched. */
export function shotsFor(type: string): Shot[] {
  return garmentType(type).value === "saree" ? SAREE_SHOTS : GARMENT_SHOTS;
}

/** A slot's shot, for its label: the photographer's list first, then the studio's. */
export function shotFor(type: string, slot: string): Shot | undefined {
  if (slot === TAG_SHOT.slot) return TAG_SHOT;
  return captureShotsFor(type).find((s) => s.slot === slot) ?? shotsFor(type).find((s) => s.slot === slot);
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
