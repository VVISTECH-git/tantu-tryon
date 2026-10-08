// Worn images for training pairs, straight from Gemini with the key in .env.local (8 Oct:
// the house account's Tantu credit was used up; the user said to use the Gemini key directly).
// Same prompt as the site: the garment's cut read from its photo, the type's poses rotated
// across the products, the gallery look. Saves each image with its prompt beside it.
//
//   npx tsx scripts/gemini-pairs.ts frock            (from apps/web)
//   env: MODEL (default gemini-3.1-flash-image), SIZE (1K), OUT (C:\Tantu-Tests\pairs)
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const CATALOGUE = "C:\\Tantu-Tests";
const TYPE_MAP: Record<string, string> = { saree: "saree", kurti: "kurti", frock: "frock", blouse: "blouse", "co-ord set": "coord_set", "top and skirt": "lehenga", dupatta: "dupatta" };

function rows(): { id: string; type: string }[] {
  const [head, ...lines] = readFileSync(path.join(CATALOGUE, "catalogue.csv"), "utf8").trim().split(/\r?\n/);
  const cols = head!.split(",");
  const iId = cols.indexOf("id");
  const iType = cols.indexOf("type");
  return lines.map((l) => l.split(",")).map((c) => ({ id: c[iId]!, type: TYPE_MAP[c[iType]!] ?? c[iType]! }));
}

async function main() {
  const kind = process.argv[2] ?? "frock";
  const model = process.env.MODEL || "gemini-3.1-flash-image";
  const size = (process.env.SIZE || "1K") as "1K" | "2K" | "4K";
  const out = path.join(process.env.OUT || path.join(CATALOGUE, "pairs"), kind);
  mkdirSync(out, { recursive: true });
  const skip = new Set((process.env.SKIP ?? "").split(",").filter(Boolean));

  const { generateImage } = await import("@tantu/engine");
  const { describeGarmentCut } = await import("../src/lib/describe");
  const { qwenPrompt } = await import("../src/lib/qwenPrompt");
  const { posesFor } = await import("../src/content/poses");
  const poses = posesFor(kind).map((p) => p.id);
  const list = rows().filter((r) => r.type === kind);
  console.log(`${list.length} ${kind} products, ${model} ${size}, poses ${poses.join(" ")}`);

  let made = 0;
  const one = async (r: { id: string }, i: number) => {
    const pose = poses[i % poses.length]!;
    const file = path.join(out, `${r.id}-${pose}.png`);
    if (skip.has(r.id) || existsSync(file)) return `${r.id}: skipped`;
    const dir = path.join(CATALOGUE, "catalogue", r.id);
    const photo = readdirSync(dir).filter((f) => /^\d\d\.(jpe?g|png)$/i.test(f)).sort()[0];
    if (!photo) return `${r.id}: no photo`;
    const bytes = readFileSync(path.join(dir, photo));
    const mime = photo.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const data = bytes.toString("base64");
    const t0 = Date.now();
    const read = await describeGarmentCut(data, mime);
    const garment = { garmentType: kind, parts: [{ slot: "whole", key: photo }], words: read.ok ? { garmentSpec: read.spec } : {} } as never;
    const prompt = qwenPrompt(garment, pose, { modelType: "woman", age: "early 20s", background: "gallery", quality: "standard" });
    try {
      const image = await generateImage({ prompt, images: [{ data, mime }], model, aspectRatio: "3:4", imageSize: size });
      writeFileSync(file, Buffer.from(image.data, "base64"));
      writeFileSync(file.replace(/\.png$/, ".json"), JSON.stringify({ product: r.id, pose, model, size, input: path.join(dir, photo), spec: read.ok ? read.spec : null, prompt }, null, 1));
      made++;
      return `${r.id} ${pose}: done ${((Date.now() - t0) / 1000).toFixed(0)}s`;
    } catch (error) {
      return `${r.id} ${pose}: FAILED ${String(error instanceof Error ? error.message : error).slice(0, 160)}`;
    }
  };

  // Two at a time.
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= list.length) return;
      console.log(await one(list[i]!, i));
    }
  };
  await Promise.all([worker(), worker()]);
  console.log(`DONE: ${made} images made in ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
