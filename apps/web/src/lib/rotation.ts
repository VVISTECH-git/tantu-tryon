/**
 * A photograph's orientation, as chosen in the Studio.
 *
 * SLK's photographs sometimes arrive on their side — a border shot with the
 * phone held the wrong way. The correction is chosen once, in the Studio,
 * and travels as a query string to everything that serves that photograph:
 * the download, the sheet, the full-size view. One number, so they cannot
 * disagree, and the model never gets a sideways border while the person
 * sees an upright one.
 *
 * Quarter turns only. A quarter turn of raster pixels is exact — no
 * resampling — so applying it never costs detail. Anything else would.
 */

export type Quarter = 0 | 90 | 180 | 270;
export type Rotations = Record<string, Quarter>;

export const QUERY_KEY = "r";

/** `body:90,border:270` → { body: 90, border: 270 }. Unknown or odd values are dropped. */
export function parseRotations(value: string | null): Rotations {
  const out: Rotations = {};
  if (!value) return out;
  for (const pair of value.split(",")) {
    const [slot, deg] = pair.split(":");
    const n = Number(deg);
    if (slot && /^[a-z-]{1,20}$/.test(slot) && (n === 90 || n === 180 || n === 270)) {
      out[slot] = n;
    }
  }
  return out;
}

/** The inverse — omits zeros, so an untouched product has no query at all. */
export function rotationQuery(rotations: Rotations): string {
  const pairs = Object.entries(rotations)
    .filter(([, deg]) => deg !== 0)
    .map(([slot, deg]) => `${slot}:${deg}`);
  return pairs.length ? `?${QUERY_KEY}=${pairs.join(",")}` : "";
}

export function turn(deg: Quarter): Quarter {
  return ((deg + 90) % 360) as Quarter;
}
