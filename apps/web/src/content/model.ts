/**
 * The model brief's vocabularies.
 *
 * `value` is a prompt-ready fragment, dropped straight into the sentence the
 * engine composes — so "in her mid-20s", not "25". `label` is what the dropdown
 * shows. They are written separately rather than derived from one another,
 * because stripping "in her" off the front of a phrase produces captions like
 * "her mid-20s".
 *
 * The first entry of each list matches the engine's own default in compose.ts,
 * so a dropdown left alone shows exactly what would have happened anyway.
 *
 * Jewellery deliberately has no list: the combinations are endless and it is
 * the field people genuinely write in. Anything else unusual goes through
 * "write it out", which replaces the whole brief with a sentence of your own.
 */

export interface BriefOption {
  value: string;
  label: string;
}

export const AGES: BriefOption[] = [
  { value: "in her mid-20s", label: "Mid 20s" },
  { value: "in her early 20s", label: "Early 20s" },
  { value: "in her late 20s", label: "Late 20s" },
  { value: "in her early 30s", label: "Early 30s" },
  { value: "in her mid-30s", label: "Mid 30s" },
  { value: "in her 40s", label: "40s" },
  { value: "in her 50s", label: "50s" },
];

export const BUILDS: BriefOption[] = [
  { value: "of average height and build", label: "Average" },
  { value: "petite", label: "Petite" },
  { value: "tall and slim", label: "Tall and slim" },
  { value: "with a fuller figure", label: "Fuller figure" },
  { value: "plus size", label: "Plus size" },
];

/**
 * Neutral tone descriptions on purpose. Indian retail copy still reaches for
 * "fair" and "wheatish", and those carry a colourism this product has no reason
 * to bake into a dropdown that a thousand catalogues get built from.
 */
export const COMPLEXIONS: BriefOption[] = [
  { value: "with a warm Indian complexion", label: "Warm" },
  { value: "with a light complexion", label: "Light" },
  { value: "with a medium complexion", label: "Medium" },
  { value: "with a deep complexion", label: "Deep" },
];

export const HAIR: BriefOption[] = [
  { value: "with dark hair worn down", label: "Worn down" },
  { value: "with hair in a low bun", label: "Low bun" },
  { value: "with a long braid", label: "Long braid" },
  { value: "with hair in a high bun", label: "High bun" },
  { value: "with short hair", label: "Short" },
];
