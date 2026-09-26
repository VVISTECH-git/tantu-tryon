/**
 * The product code among the lines printed on a tag, read on the phone
 * (build 1.0.1): tags like SW-B605-KAW-CNA-003-0260 carry a QR code phones
 * cannot decode (26 Sep), but the same code printed beside it. The code is
 * the longest run of letters and digits joined by hyphens, three parts or
 * more; spaces the reader puts around hyphens are closed up.
 */
export function codeFromTagText(lines: string[]): string | null {
  const candidates = lines
    .map((l) => l.toUpperCase().replace(/\s*-\s*/g, "-"))
    .flatMap((l) => l.match(/[A-Z0-9]{1,12}(?:-[A-Z0-9]{1,12}){2,}/g) ?? []);
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}
