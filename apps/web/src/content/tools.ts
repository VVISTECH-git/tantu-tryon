/**
 * The tool list, and a rule about it: nothing is described here that the engine
 * cannot actually do. Anything not yet built is marked `planned` and reads as
 * planned on the page. A catalogue of features that do not exist is the easiest
 * lie in this market and the fastest way to lose a wholesale buyer.
 */

export interface Tool {
  slug: string;
  name: string;
  kicker: string;
  summary: string;
  status: "live" | "planned";
  /** What you give it. */
  takes: string[];
  /** What comes back. */
  gives: string[];
  /** Why it exists, in one paragraph. */
  body: string;
  /** The honest limitation. Every tool gets one. */
  caveat: string;
}

export const TOOLS: Tool[] = [
  {
    slug: "product-to-model",
    name: "Product to Model",
    kicker: "Catalogue photography",
    summary:
      "Labelled photographs of a garment become a model wearing that exact garment. No model photograph needed.",
    status: "live",
    takes: [
      "Full drape, pallu, body, border and blouse as separate labelled shots",
      "A description of who should wear it — or nothing, and take the default",
      "A scene and the poses you want",
    ],
    gives: ["One catalogue image per pose, from the same references", "The exact prompt used, to edit and re-run"],
    body: "Most tools take one flat photograph of a garment and ask a model to imagine the rest. On a saree that means the pallu, the pleats and the border get invented, and what comes back is a garment that resembles yours without being it. Tantu takes each part as its own labelled shot and tells the engine what each one is, so there is nothing left to guess at.",
    caveat:
      "It is still a generative model. It will occasionally drift, which is why every render can be wiped against the original fabric before you use it.",
  },
  {
    slug: "mannequin-to-model",
    name: "Mannequin to Model",
    kicker: "Highest fidelity",
    summary:
      "Drape the garment on a mannequin, photograph it, and only the mannequin is replaced by a person.",
    status: "live",
    takes: ["One photograph of the garment draped on a mannequin, head to hem"],
    gives: ["The same photograph with a real model in place of the mannequin"],
    body: "The drape in the photograph is physically real — your pleats, your border placement, your fall. The engine is instructed not to re-drape, re-fold or re-pattern anything; it swaps the mannequin for a person and leaves the garment alone. This is the most accurate route to a catalogue image, and it costs one mannequin and five minutes of somebody's time.",
    caveat: "It needs the mannequin shot. No mannequin, no mannequin mode.",
  },
  {
    slug: "virtual-try-on",
    name: "Virtual Try-On",
    kicker: "Dress a real person",
    summary: "A photograph of a person, and the garment goes onto them with their face preserved.",
    status: "live",
    takes: ["A photograph of the person", "The garment references"],
    gives: ["The same person wearing the garment"],
    body: "Useful for a buyer who wants to see a piece on a particular person, and the foundation of the shopper-facing widget that goes on a product page later.",
    caveat:
      "Photographs of people carry obligations. Consent, a retention window and a deletion path are being built before this goes anywhere near a public storefront — it is a studio tool today.",
  },
  {
    slug: "pose-sets",
    name: "Pose Sets",
    kicker: "One shoot, many angles",
    summary: "Front, three-quarter, back, waist-up, walking, seated and two macro details.",
    status: "live",
    takes: ["The same references, once"],
    gives: ["One image per pose, rendered in parallel and streamed back as they finish"],
    body: "A single viewpoint lowers buyer confidence, which is why catalogue sets exist. Every pose is rendered from the same reference photographs, so the garment stays identical across the set while the body moves. A pose that fails is retried on its own rather than costing you the others.",
    caveat: "Each pose is a separate generation, so nine poses cost nine images.",
  },
  {
    slug: "fidelity-check",
    name: "Fidelity Check",
    kicker: "The part nobody else does",
    summary: "Wipe between the render and the real fabric to see whether the motif survived.",
    status: "live",
    takes: ["Nothing — it uses the reference you already gave"],
    gives: ["A registered side-by-side wipe, at full size"],
    body: "The failure mode that matters is not a bad pose, it is a motif that is nearly yours. It is invisible in a gallery and obvious the moment the two images are laid over each other. Every render keeps the reference it came from so this is always available, including months later.",
    caveat: "It shows you the drift. Judging whether it matters is still yours to do.",
  },
  {
    slug: "export-presets",
    name: "Marketplace Exports",
    kicker: "Ready to list",
    summary: "Square, 4:5, 9:16 and 16:9, re-framed on white without cropping the garment.",
    status: "live",
    takes: ["Any render"],
    gives: ["A correctly proportioned file for Amazon, Flipkart, Shopify, Instagram or a banner"],
    body: "A catalogue image that has to go through a separate editor before it can be listed is not finished. These are generated in the browser from the render you are looking at.",
    caveat: "Re-framing only. Background removal and retouching are not part of it.",
  },
  {
    slug: "colourway-batch",
    name: "Colourway Batches",
    kicker: "Planned",
    summary: "Render every colour of a design in one pass, filed under the design it belongs to.",
    status: "planned",
    takes: ["A design and its colourways"],
    gives: ["A full pose set per colour"],
    body: "A manufacturer does not have one saree, they have one design in eleven colours. Batching by colourway is the difference between a demo and something that keeps up with a production floor.",
    caveat: "Not built yet. It needs the server-side product model that is currently in progress.",
  },
  {
    slug: "api",
    name: "Render API",
    kicker: "Planned",
    summary: "The same engine behind an API key, for storefronts and other sellers.",
    status: "planned",
    takes: ["A scoped key and a render request"],
    gives: ["The same images, programmatically"],
    body: "The engine is already a separate package with no dependency on any one customer's system, so opening it up is a matter of keys, quotas and metering rather than a rewrite.",
    caveat: "Not built yet, and it will not open until our own catalogue has been running on it.",
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((tool) => tool.slug === slug);
