import sharp from "sharp";
import type { OverlayOptions } from "sharp";

/**
 * Composites the parts of one garment into a single labelled sheet.
 *
 * Two reasons this exists, both measured rather than assumed:
 *
 * 1. Five separate images crowd out the pose instruction. With the four
 *    textile photographs removed entirely, the model produced the crossed
 *    ankle correctly; with them present it never did. One sheet takes the
 *    request from five images to two.
 *
 * 2. The border keeps coming back far too wide. Sent as its own photograph it
 *    arrives the same size as the body, so nothing tells the model that the
 *    real strip is narrow. On a sheet its proportion is visible.
 *
 * Each panel is letterboxed rather than cropped: a border photographed as a
 * tall narrow strip must still read as a tall narrow strip, and `cover` would
 * fill the cell with a magnified detail of it.
 */

export interface SheetPart {
  key: string;
  label: string;
  data: string;
}

const CELL = 620;
const LABEL_H = 46;
const PAD = 14;

function labelSvg(text: string, width: number, height: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <rect width="100%" height="100%" fill="#111111"/>
       <text x="16" y="${height / 2 + 8}" font-family="Arial, Helvetica, sans-serif"
             font-size="26" font-weight="bold" fill="#ffffff">${text}</text>
     </svg>`,
  );
}

/**
 * @returns raw base64 PNG of the sheet, and the caption describing its layout.
 */
export async function buildContactSheet(
  parts: SheetPart[],
): Promise<{ data: string; layout: string }> {
  const cols = 2;
  const rows = Math.ceil(parts.length / cols);
  const cellW = CELL;
  const cellH = CELL + LABEL_H;
  const width = cols * cellW;
  const height = rows * cellH;

  const composites: OverlayOptions[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;

    const panel = await sharp(Buffer.from(part.data, "base64"))
      .resize(cellW - PAD * 2, CELL - PAD * 2, {
        // Contain, never cover — the border's narrowness is information.
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    composites.push({ input: labelSvg(part.label, cellW, LABEL_H), left: x, top: y });
    composites.push({ input: panel, left: x + PAD, top: y + LABEL_H + PAD });
  }

  const sheet = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const layout = parts
    .map((p, i) => `${p.label} in the ${position(i, cols, rows)} panel`)
    .join(", ");

  return { data: sheet.toString("base64"), layout };
}

function position(index: number, cols: number, rows: number): string {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const vertical = rows === 1 ? "" : row === 0 ? "top " : row === rows - 1 ? "bottom " : "middle ";
  const horizontal = col === 0 ? "left" : "right";
  return `${vertical}${horizontal}`;
}
