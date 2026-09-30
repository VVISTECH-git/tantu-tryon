/**
 * The app's colours and radii.
 *
 * C is the light, business look for every ordinary screen (30 Sep): warm
 * white ground, near-black ink, and the Tantu orange kept for the one main
 * action on a screen. Warm neutrals rather than cold greys, the colour of
 * unbleached cotton, so the saree photos sit on something that belongs to them.
 *
 * D is the dark set for the photo screens only (camera, editor, viewer,
 * scanner): photo apps show pictures on black so their colours read true.
 */
export const C = {
  page: "#F7F5F1",
  surface: "#FFFFFF",
  surfaceStrong: "#F0EDE8",
  text: "#1C1A17",
  textSoft: "#57514A",
  textMuted: "#8B847B",
  border: "#E7E2DA",
  borderStrong: "#D5CEC4",
  /** Quiet fills: chips, rows, empty photo slots. */
  fill: "#F1EDE7",
  fillStrong: "#E8E3DB",
  /** The Tantu orange, deep enough to read on white. */
  accent: "#B8561A",
  accentStrong: "#C95F1C",
  accentPale: "#B8561A",
  accentTint: "rgba(201, 95, 28, 0.09)",
  accentLine: "rgba(201, 95, 28, 0.32)",
  actionTop: "#C95F1C",
  actionBottom: "#A94F16",
  onAction: "#FFFFFF",
  violet: "#4b2282",
  violetText: "#57514A",
  good: "#1F8A57",
  goodTint: "rgba(31, 138, 87, 0.09)",
  warn: "#9A6400",
  warnTint: "rgba(154, 100, 0, 0.08)",
  bad: "#B83A2E",
  badTint: "rgba(184, 58, 46, 0.08)",
  warnBorder: "rgba(154, 100, 0, 0.35)",
  badBorder: "rgba(184, 58, 46, 0.4)",
} as const;

/** The dark set, for screens that show photos full size. */
export const D = {
  page: "#0f0f10",
  surface: "#171718",
  surfaceStrong: "#1d1d1f",
  text: "#f4efe6",
  textSoft: "rgba(244, 239, 230, 0.68)",
  textMuted: "rgba(244, 239, 230, 0.46)",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  accent: "#db7124",
  accentStrong: "#f08d42",
  accentPale: "#f0b17e",
  actionTop: "#e67e34",
  actionBottom: "#c9641d",
  violet: "#4b2282",
  violetText: "#d8c3ff",
  good: "#8fe0b6",
  warn: "#f4cf7c",
  bad: "#ff9f99",
  warnBorder: "rgba(224, 162, 58, 0.45)",
  badBorder: "rgba(227, 73, 73, 0.5)",
} as const;

export const R = { pill: 999, lg: 20, md: 14, sm: 10 } as const;
