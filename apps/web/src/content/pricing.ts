/**
 * Pricing.
 *
 * Built from the bottom up: a standard render costs roughly ₹3.50 to produce,
 * so the ladder runs from about 3.4× at the trial pack down to 1.7× at mill
 * volume. That undercuts the market at scale — the tools charging ₹8.3 for
 * bulk are taking a 2.4× margin on the same underlying model — while leaving
 * enough room at the entry pack to absorb the people who try it once and leave.
 *
 * Two commitments are load-bearing and should survive any repricing:
 *   1. Credits do not expire, and no page says otherwise. The competitor's
 *      cards promise "credits never expire" while its own FAQ says thirty days.
 *   2. A failed render is not charged. It is why failures are tracked per pose
 *      rather than per batch.
 */

export interface Pack {
  id: string;
  name: string;
  audience: string;
  images: number;
  inr: number;
  featured?: boolean;
  includes: string[];
}

export const COST_TO_US_PER_IMAGE_INR = 3.5;

export const PACKS: Pack[] = [
  {
    id: "trial",
    name: "Trial",
    audience: "Finding out whether it holds your motif",
    images: 25,
    inr: 299,
    includes: [
      "Every tool — nothing held back",
      "Fidelity check against your own fabric",
      "Marketplace exports",
      "Commercial use",
    ],
  },
  {
    id: "boutique",
    name: "Boutique",
    audience: "A shop putting up new arrivals",
    images: 150,
    inr: 1299,
    includes: [
      "Everything in Trial",
      "Full nine-pose sets",
      "Mannequin mode",
      "Renders kept, searchable and re-runnable",
    ],
  },
  {
    id: "house",
    name: "House",
    audience: "A manufacturer running a catalogue",
    images: 600,
    inr: 4199,
    featured: true,
    includes: [
      "Everything in Boutique",
      "Colourway batches when they ship",
      "High-quality renders for hero shots",
      "Priority support from the people who build it",
    ],
  },
  {
    id: "mill",
    name: "Mill",
    audience: "Volume, and wholesale buyers of your own",
    images: 2500,
    inr: 14999,
    includes: [
      "Everything in House",
      "Render API access when it opens",
      "A shared library across your team",
      "A named contact, not a queue",
    ],
  },
];

export const perImage = (pack: Pack) => pack.inr / pack.images;

/** What a traditional shoot costs per image, for the comparison table. */
export const STUDIO_COST_INR = { low: 200, high: 500 };

/** The warm way in for a manufacturer who would rather not touch the tool. */
export const DONE_FOR_YOU = {
  fromInr: 2500,
  turnaround: "3–4 working days",
  what: "Send us one design in its colourways. We photograph it properly, render the sets, check every motif against the cloth and hand back files ready to list.",
};
