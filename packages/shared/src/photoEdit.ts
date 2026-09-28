/**
 * The edit screen's choices (28 Sep): crop, quarter turns, straighten and a
 * light brightness change. The saved photo is the edited photo, made at full
 * resolution and the highest JPEG quality; the geometry here tells the phone
 * where to cut.
 *
 * Order, the same everywhere: the photo upright (its orientation tag
 * applied) → turned by quarter + angle, on a canvas grown to hold it → the
 * largest level rectangle inside the turned photo (so no corner of empty
 * canvas shows) → the crop, in fractions of that rectangle → brightness.
 * No filters: they change the saree's colour, and the buyer gets a saree
 * that does not match its picture.
 */
export interface PhotoEdit {
  /** Quarter turns clockwise. */
  quarter?: 0 | 90 | 180 | 270;
  /** Straighten, degrees clockwise, within ±MAX_ANGLE. */
  angle?: number;
  /** Fractions (0–1) of the straightened photo. */
  crop?: { x: number; y: number; w: number; h: number };
  /** −MAX_BRIGHTNESS … +MAX_BRIGHTNESS; 0.1 is 10% brighter. */
  brightness?: number;
}

export const MAX_ANGLE = 10;
export const MAX_BRIGHTNESS = 0.25;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** An edit made safe: known fields only, within range; null when it changes nothing. */
export function cleanEdit(raw: unknown): PhotoEdit | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const out: PhotoEdit = {};
  if (e.quarter === 90 || e.quarter === 180 || e.quarter === 270) out.quarter = e.quarter;
  if (typeof e.angle === "number" && Number.isFinite(e.angle) && Math.abs(e.angle) >= 0.1) out.angle = Math.round(clamp(e.angle, -MAX_ANGLE, MAX_ANGLE) * 10) / 10;
  if (typeof e.brightness === "number" && Number.isFinite(e.brightness) && Math.abs(e.brightness) >= 0.01) {
    out.brightness = Math.round(clamp(e.brightness, -MAX_BRIGHTNESS, MAX_BRIGHTNESS) * 100) / 100;
  }
  const c = e.crop as Record<string, unknown> | undefined;
  if (c && [c.x, c.y, c.w, c.h].every((v) => typeof v === "number" && Number.isFinite(v))) {
    const x = clamp(c.x as number, 0, 0.95);
    const y = clamp(c.y as number, 0, 0.95);
    const w = clamp(c.w as number, 0.05, 1 - x);
    const h = clamp(c.h as number, 0.05, 1 - y);
    if (!(x < 0.005 && y < 0.005 && w > 0.99 && h > 0.99)) out.crop = { x: round4(x), y: round4(y), w: round4(w), h: round4(h) };
  }
  return Object.keys(out).length ? out : null;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** The size of a W×H photo after its quarter turns. */
export function turnedSize(width: number, height: number, quarter: PhotoEdit["quarter"] = 0): { width: number; height: number } {
  return quarter === 90 || quarter === 270 ? { width: height, height: width } : { width, height };
}

/**
 * Where to cut, in pixels of the photo after it has been turned by quarter +
 * angle onto a canvas grown to hold it (the canvas size is returned too).
 * `width`/`height` are the upright photo's, before any turn.
 */
export function editRect(width: number, height: number, edit: PhotoEdit | null | undefined): { canvas: { width: number; height: number }; cut: Rect } {
  const t = turnedSize(width, height, edit?.quarter);
  const a = ((edit?.angle ?? 0) * Math.PI) / 180;
  const sin = Math.abs(Math.sin(a));
  const cos = Math.abs(Math.cos(a));
  const canvas = { width: t.width * cos + t.height * sin, height: t.width * sin + t.height * cos };

  // The largest level rectangle inside the turned photo.
  let innerW = t.width;
  let innerH = t.height;
  if (sin > 1e-6) {
    const long = Math.max(t.width, t.height);
    const short = Math.min(t.width, t.height);
    if (short <= 2 * sin * cos * long || Math.abs(sin - cos) < 1e-10) {
      const x = 0.5 * short;
      [innerW, innerH] = t.width >= t.height ? [x / sin, x / cos] : [x / cos, x / sin];
    } else {
      const cos2 = cos * cos - sin * sin;
      innerW = (t.width * cos - t.height * sin) / cos2;
      innerH = (t.height * cos - t.width * sin) / cos2;
    }
  }
  const inner = { left: (canvas.width - innerW) / 2, top: (canvas.height - innerH) / 2, width: innerW, height: innerH };
  const c = edit?.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const cut = {
    left: Math.floor(inner.left + c.x * inner.width),
    top: Math.floor(inner.top + c.y * inner.height),
    width: Math.max(1, Math.floor(c.w * inner.width)),
    height: Math.max(1, Math.floor(c.h * inner.height)),
  };
  return { canvas: { width: Math.round(canvas.width), height: Math.round(canvas.height) }, cut };
}

/** The finished size of an edited photo, for the quality check's size rule. */
export function editedSize(width: number, height: number, edit: PhotoEdit | null | undefined): { width: number; height: number } {
  const { cut } = editRect(width, height, edit);
  return { width: cut.width, height: cut.height };
}
