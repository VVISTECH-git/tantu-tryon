import { and, count, desc, eq, isNull } from "drizzle-orm";
import { TEMPLATES, composePrompt, promptVersion } from "@/content/promptTemplates";
import { db, garments, generations, type Garment, type GenerationLook } from "@/db";
import { attachmentsFor, partPlan, wordsFor } from "@/lib/garments";
import { selectionsFor } from "@/lib/generate";
import { assetUrl } from "@/lib/storage";

/**
 * What a product would feed the image model, before anything is generated
 * (28 Sep): its photos, its input sheet and the prompt each pose would send
 * with the phone's default look. For the platform admin's Products page.
 */
export interface ProductInputs {
  id: string;
  productCode: string | null;
  title: string;
  parts: { slot: string; url: string; previewUrl: string | null; width: number | null; height: number | null; quality: string | null; takenBy: string | null; takenAt: string | null }[];
  /** Null until the sheet is first built (Continue on the phone). */
  sheetUrl: string | null;
  prompts: { promptId: string; title: string; version: string; text: string }[];
}

/** The look the phone always sends. */
const PHONE_LOOK: GenerationLook = { modelType: "woman", age: "late 20s", background: "courtyard", quality: "standard" };
const POSES = ["P1", "P2", "P3", "P4"];

/** One row of the Products page: every captured product, newest first. */
export interface ProductRow {
  id: string;
  productCode: string | null;
  title: string;
  photos: { slot: string; thumbUrl: string }[];
  /** Everyone who took a photo of it. */
  takenBy: string[];
  lastTakenAt: string | null;
  sheetReady: boolean;
  generations: number;
}

export async function productRows(): Promise<ProductRow[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(garments).where(isNull(garments.deletedAt)).orderBy(desc(garments.updatedAt)),
    db.select({ garmentId: generations.garmentId, n: count() }).from(generations).groupBy(generations.garmentId),
  ]);
  const made = new Map(counts.map((c) => [c.garmentId, c.n]));
  return rows
    .filter((g) => g.parts.length > 0)
    .map((g) => {
      const times = g.parts.map((p) => p.takenAt).filter((t): t is string => Boolean(t)).sort();
      return {
        id: g.id,
        productCode: g.productCode,
        title: g.title,
        photos: g.parts.map((p) => ({ slot: p.slot, thumbUrl: p.thumbKey ? assetUrl(p.thumbKey) : p.previewKey ? assetUrl(p.previewKey) : p.key ? assetUrl(p.key) : p.url })),
        takenBy: [...new Set(g.parts.map((p) => p.takenBy).filter((t): t is string => Boolean(t)))],
        lastTakenAt: times.at(-1) ?? null,
        sheetReady: Boolean(g.sheetKey && g.sheetKey.endsWith(".w2.jpg")),
        generations: made.get(g.id) ?? 0,
      };
    });
}

/** One product by its database id, for the detail view (works for products with no ID too). */
export async function productInputsById(id: string): Promise<ProductInputs | null> {
  const [g] = await db.select().from(garments).where(and(eq(garments.id, id), isNull(garments.deletedAt))).limit(1);
  return g ? inputsOf(g) : null;
}

export async function productInputs(productCode: string): Promise<ProductInputs[]> {
  const rows = await db.select().from(garments).where(and(eq(garments.productCode, productCode), isNull(garments.deletedAt)));
  return rows.map(inputsOf);
}

function inputsOf(g: Garment): ProductInputs {
  const plan = partPlan(g);
  const words = wordsFor(g);
  const files = attachmentsFor(g);
  const selections = selectionsFor(PHONE_LOOK);
  return {
    id: g.id,
    productCode: g.productCode,
    title: g.title,
    parts: g.parts.map((p) => ({
      slot: p.slot,
      url: p.key ? assetUrl(p.key) : p.url,
      previewUrl: p.previewKey ? assetUrl(p.previewKey) : null,
      width: p.width,
      height: p.height,
      quality: p.quality?.status ?? null,
      takenBy: p.takenBy ?? null,
      takenAt: p.takenAt ?? null,
    })),
    sheetUrl: g.sheetKey && g.sheetKey.endsWith(".w2.jpg") ? assetUrl(g.sheetKey) : null,
    prompts: g.parts.length
      ? TEMPLATES.filter((t) => POSES.includes(t.id) && t.live).map((t) => ({
          promptId: t.id,
          title: t.title,
          version: promptVersion(t, plan),
          text: composePrompt(t, words, selections, files, plan),
        }))
      : [],
  };
}
