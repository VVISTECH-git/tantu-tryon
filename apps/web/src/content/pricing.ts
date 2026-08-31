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
 *
 * There is deliberately no billing-period toggle anywhere: these are one-time
 * packs, not a subscription, and a toggle would imply otherwise.
 */

export interface Pack {
  id: string;
  name: string;
  /** One line on who the pack is for. */
  audience: string;
  images: number;
  inr: number;
  featured?: boolean;
  cta: string;
  /** Reassurance directly under the button. */
  microcopy: string;
  includes: string[];
}

export const COST_TO_US_PER_IMAGE_INR = 3.5;

export const PACKS: Pack[] = [
  {
    id: "trial",
    name: "Trial",
    audience: "For trying Tantu on your first few designs.",
    images: 25,
    inr: 299,
    cta: "Get Trial",
    microcopy: "One-time. No card kept on file.",
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
    audience: "For shops adding new arrivals regularly.",
    images: 150,
    inr: 1299,
    cta: "Get Boutique",
    microcopy: "About thirty designs at five poses each.",
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
    audience: "For manufacturers producing catalogue imagery at scale.",
    images: 600,
    inr: 4199,
    featured: true,
    cta: "Get House",
    microcopy: "The pack most catalogues settle on.",
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
    audience: "For large catalogues and teams.",
    images: 2500,
    inr: 14999,
    cta: "Get Mill",
    microcopy: "Shared across everyone on your team.",
    includes: [
      "Everything in House",
      "Render API access when it opens",
      "Shared library across your team",
      "Named contact, not a queue",
    ],
  },
];

export const perImage = (pack: Pack) => pack.inr / pack.images;

export const packById = (id: string) => PACKS.find((pack) => pack.id === id)!;

/** Rupees, grouped the Indian way — 14,999 not 14,999 by thousands. */
export const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** The per-image rate as the card actually prints it, to one decimal. */
export const displayedRate = (pack: Pack) => Number(perImage(pack).toFixed(1));

/**
 * The note under a pack's unit price. Only two packs get one — the
 * recommendation and the cheapest rate. A badge on every card flattens the
 * hierarchy the recommendation depends on, and neither line invents a discount
 * that does not exist: both are plain descriptions of where the pack sits.
 */
export function valueNote(pack: Pack): string | null {
  const cheapest = PACKS.reduce((best, other) =>
    perImage(other) < perImage(best) ? other : best,
  );
  if (pack.id === cheapest.id) return "Lowest cost per image";
  if (pack.featured) return "Best balance of volume + price";
  return null;
}

/** What a traditional shoot costs per image, for the comparison. */
export const STUDIO_COST_INR = { low: 200, high: 500 };

/** The warm way in for a manufacturer who would rather not touch the tool. */
export const DONE_FOR_YOU = {
  fromInr: 2500,
  turnaround: "3–4 working days",
  what: "Send us one design in its colourways. We photograph it properly, render the sets, check every motif against the cloth and hand back files ready to list.",
};

export const SCENARIOS = [
  {
    situation: "Just testing Tantu",
    packId: "trial",
    body: "For checking how accurately Tantu handles your fabric and motif.",
  },
  {
    situation: "Running a boutique catalogue",
    packId: "boutique",
    body: "For shops adding new arrivals regularly.",
  },
  {
    situation: "Building a serious catalogue",
    packId: "house",
    body: "For manufacturers and brands producing catalogue imagery at scale.",
  },
  {
    situation: "High-volume or a team",
    packId: "mill",
    body: "For large catalogues, wholesale buyers and teams.",
  },
];

export const PHILOSOPHY = [
  {
    title: "Credits don't expire",
    body: "Buy images today. Use them when you need them.",
    mark: "∞",
  },
  {
    title: "Failed renders don't cost you",
    body: "If a pose fails, you don't lose the credit.",
    mark: "0",
  },
  {
    title: "Commercial use included",
    body: "Use your renders on your website, Shopify, marketplaces, advertising and print.",
    mark: "©",
  },
];

export const STEPS = [
  {
    n: "01",
    title: "Buy a pack",
    body: "Choose the number of images that fits your catalogue.",
  },
  {
    n: "02",
    title: "Upload your garment",
    body: "Use your existing garment and fabric photographs.",
  },
  {
    n: "03",
    title: "Generate and reuse",
    body: "Create model-worn imagery, check fidelity, and reuse your credits whenever you need them.",
  },
];

export const FAQ = [
  {
    q: "Do credits expire?",
    a: "No. Not after thirty days, not at the end of a month, not at all. If that ever changes it will change here first, and you will be told before it applies to anything you have already bought.",
  },
  {
    q: "Am I charged for a render that fails?",
    a: "No. Failures are tracked per pose rather than per batch, so one refused image never costs you the other four. If you press Stop, poses that had not started never start.",
  },
  {
    q: "Can I sell the images?",
    a: "Yes. Every pack includes commercial use — your own website, your Shopify store, marketplace listings, advertising and print.",
  },
  {
    q: "What happens to the photographs I upload?",
    a: "They are sent to the image engine to make your render and are not used to train anything. Your renders are kept so you can find them and run them again, and you can delete any of them at any time.",
  },
  {
    q: "How many images is a saree?",
    a: "A standard catalogue set is five poses. Nine if you also want the walking, seated and macro detail shots. Most people settle on five per colourway.",
  },
  {
    q: "Is there a subscription?",
    a: "No. You buy a pack of images once and use them when you use them. There is no monthly plan, no annual plan and no billing cycle to keep track of.",
  },
];
