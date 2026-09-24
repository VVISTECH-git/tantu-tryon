/**
 * The studio's colours and radii, the same values as apps/web's studio.css,
 * so the phone and the browser read as one product.
 */
export const C = {
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

export const R = { pill: 999, lg: 22, md: 16, sm: 12 } as const;
