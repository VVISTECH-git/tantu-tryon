import type { Tone } from "@/components/site/art/Ornament";

/**
 * Home-page copy, kept out of the layout so the argument can be edited without
 * touching markup. Nothing here claims a capability the engine does not have.
 */

export const TRUST = [
  "Nine poses from one set of photographs",
  "No model photograph needed",
  "Every render kept and re-runnable",
];

/** The labelled shots that go in. */
export const SHOWCASE_SLOTS: { label: string; tone: Tone }[] = [
  { label: "Pallu", tone: "madder" },
  { label: "Body", tone: "indigo" },
  { label: "Border", tone: "turmeric" },
  { label: "Blouse", tone: "cream" },
];

/** The catalogue set that comes out. */
export const SHOWCASE_POSES = ["Front", "Three-quarter", "Back", "Waist-up", "Walking"];

export const MODES: { name: string; tone: Tone; body: string }[] = [
  {
    name: "Describe a model",
    tone: "madder",
    body: "No model photograph at all. Say who should wear it — or say nothing and take the default — and the model is invented around your garment.",
  },
  {
    name: "Mannequin to model",
    tone: "indigo",
    body: "Drape it on a mannequin and photograph it. Only the mannequin is replaced. The pleats, the border placement and the fall stay physically real.",
  },
  {
    name: "Try on a person",
    tone: "turmeric",
    body: "A photograph of a person, and the garment goes onto them with their face, build and skin tone preserved.",
  },
];

/** Why this is not the same as the other tools in the category. */
export const DIFFERENCES = [
  {
    mark: "4",
    title: "Shots, each one named",
    body: "The engine is told which image is the pallu and which is the border, so it has nothing left to guess at. Everything else in this market takes one flat photograph.",
  },
  {
    mark: "=",
    title: "Checked against the cloth",
    body: "Every render keeps the fabric it came from, and wipes against it at full size. Motif drift is invisible in a gallery and obvious the moment the two are laid over each other.",
  },
  {
    mark: "∞",
    title: "Nothing is thrown away",
    body: "Renders stay attached to the design they belong to, so a colourway can be found, re-run and sent to a storefront months later.",
  },
];
