import sharp from "sharp";
import type { OverlayOptions } from "sharp";

/**
 * Composites the parts of one garment into a single labelled sheet.
 *
 * The labels are in the pixels. That is the whole reason the sheet exists: a
 * chat model is not shown attachment filenames, and attachment order is only
 * as reliable as the person doing the attaching. A word printed above each
 * panel is read the same way the fabric is read — by looking — so "which
 * image is the border" stops being a question.
 *
 * Each panel is letterboxed rather than cropped: a border photographed as a
 * narrow strip must still read as a narrow strip, and `cover` would fill the
 * cell with a magnified detail of it. The border's proportion is information.
 */

export interface SheetPart {
  key: string;
  label: string;
  /** Raw base64 of the photograph. */
  data: string;
}

export interface SheetOptions {
  /**
   * Width and height of each panel in pixels. 620 was enough for the Lab's
   * API runs; a sheet a person attaches to a chat should carry more of the
   * original's detail, since the model gets nothing else.
   */
  cell?: number;
}

function labelSvg(text: string, width: number, height: number, size: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <rect width="100%" height="100%" fill="#111111"/>
       <text x="${Math.round(size * 0.6)}" y="${Math.round(height / 2 + size * 0.36)}"
             font-family="Arial, Helvetica, sans-serif"
             font-size="${size}" font-weight="bold" fill="#ffffff">${text}</text>
     </svg>`,
  );
}

/**
 * @returns raw base64 PNG of the sheet, and the caption describing its layout.
 */
export async function buildContactSheet(
  parts: SheetPart[],
  { cell = 620 }: SheetOptions = {},
): Promise<{ data: string; layout: string }> {
  const cols = 2;
  const rows = Math.ceil(parts.length / cols);
  const labelH = Math.round(cell * 0.075);
  const pad = Math.round(cell * 0.022);
  const fontSize = Math.round(cell * 0.042);
  const cellW = cell;
  const cellH = cell + labelH;
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
      .resize(cellW - pad * 2, cell - pad * 2, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    composites.push({ input: labelSvg(part.label, cellW, labelH, fontSize), left: x, top: y });
    composites.push({ input: panel, left: x + pad, top: y + labelH + pad });
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
