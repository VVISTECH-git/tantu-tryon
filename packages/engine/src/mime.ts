/** Cheap magic-byte sniff so each image is sent with the right mime type. */
export function guessMime(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

/** Strips a `data:` prefix if one slipped in. The engine works in raw base64. */
export function toRawBase64(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma !== -1 ? value.slice(comma + 1) : value;
}

export function toDataUrl(data: string, mime: string): string {
  return `data:${mime};base64,${data}`;
}
