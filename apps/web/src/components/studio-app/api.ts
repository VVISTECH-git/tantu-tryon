import type { GenerationLook, PartQuality } from "@/db";
import { loadImageFile } from "@/lib/image";
import type { GarmentView, RunView } from "./types";

/** The studio's calls, each returning data or throwing a message a person can read. */

async function json<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status}).`);
  return payload;
}

export interface UploadResult {
  garment: GarmentView;
  quality: PartQuality;
  /** Required slots still missing or blocked. */
  missing: string[];
}

export async function uploadPart(file: File, slot: string, garmentId: string | null, type: string): Promise<UploadResult> {
  // Resize in the browser: a 40 MP phone photograph becomes a ~2000px JPEG,
  // upright and small enough for any server limit, still big enough for a
  // 1000px sheet cell.
  const loaded = await loadImageFile(file, 2000);
  const blob = await (await fetch(loaded.dataUrl)).blob();
  const form = new FormData();
  form.set("file", blob, "part.jpg");
  form.set("slot", slot);
  form.set("type", type);
  if (garmentId) form.set("garmentId", garmentId);
  return json<UploadResult>(await fetch("/api/garments/upload", { method: "POST", body: form }));
}

// ── Products (7 Oct: the same product-ID flow the phone has) ──────────────

/** This browser's own id, so the server can hold an automatic number for it as it does for a phone. */
export function deviceId(): string {
  try {
    const have = localStorage.getItem("tantu-device");
    if (have) return have;
    const made = crypto.randomUUID();
    localStorage.setItem("tantu-device", made);
    return made;
  } catch {
    return "web-" + Math.random().toString(36).slice(2, 14);
  }
}

const jsonHeaders = () => ({ "content-type": "application/json", "x-tantu-device": deviceId() });

/** Open (or reopen) the record for one product ID; every photograph after this is saved against it. */
export async function openProduct(productId: string, type: string): Promise<GarmentView> {
  const { garment } = await json<{ garment: GarmentView }>(
    await fetch("/api/garments/open", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ productId, type }) }),
  );
  return garment;
}

/** A record with no product ID; one can be given from the shot list later. */
export async function openWithoutProductId(type: string): Promise<GarmentView> {
  const { garment } = await json<{ garment: GarmentView }>(
    await fetch("/api/garments/open", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ noProductId: true, type }) }),
  );
  return garment;
}

/** The product ID the photographer's next Continue will get (9001, 9002, …). */
export async function nextAutoProductId(): Promise<string> {
  const { nextId } = await json<{ nextId: string }>(await fetch("/api/garments/open", { headers: { "x-tantu-device": deviceId() } }));
  return nextId;
}

/** Give out the next automatic product ID and open its record (photographer login). */
export async function openAutoProduct(type: string): Promise<GarmentView> {
  const { garment } = await json<{ garment: GarmentView }>(
    await fetch("/api/garments/open", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ auto: true, type }) }),
  );
  return garment;
}

/** Give a record made without a product ID its ID. */
export async function setProductId(id: string, productId: string): Promise<GarmentView> {
  return patchGarment(id, { productCode: productId });
}

export interface SavedProduct {
  id: string;
  productId: string | null;
  title: string;
  garmentType: string;
  photos: number;
  slots: string[];
  missing: string[];
  thumb: string | null;
  updatedAt: string;
  images: number;
}

export async function savedProducts(): Promise<SavedProduct[]> {
  const { products } = await json<{ products: SavedProduct[] }>(await fetch("/api/garments", { cache: "no-store" }));
  return products;
}

/** Delete a product (owner or platform admin). Images already made from it are kept. */
export async function deleteProduct(id: string): Promise<void> {
  await json(await fetch(`/api/garments/${id}`, { method: "DELETE" }));
}

export async function getGarment(id: string): Promise<{ garment: GarmentView; words: Record<string, string | null> }> {
  return json(await fetch(`/api/garments/${id}`));
}

export async function startFromCode(code: string): Promise<GarmentView> {
  const { garment } = await json<{ garment: GarmentView }>(
    await fetch("/api/garments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }),
  );
  return garment;
}

export interface Analysis {
  garment: GarmentView;
  words: Record<string, string | null>;
  warnings: { title: string; body: string }[];
  model: string | null;
  readerError: string | null;
}

export async function analyze(id: string): Promise<Analysis> {
  return json(await fetch(`/api/garments/${id}/analyze`, { method: "POST" }));
}

export async function patchGarment(
  id: string,
  patch: { words?: Record<string, string>; answers?: Record<string, boolean>; rotations?: Record<string, number>; removeSlots?: string[]; productCode?: string },
): Promise<GarmentView> {
  const { garment } = await json<{ garment: GarmentView }>(
    await fetch(`/api/garments/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }),
  );
  return garment;
}

export async function generate(garmentId: string, promptId: string, look: GenerationLook, clientKey: string): Promise<RunView> {
  const { generation } = await json<{ generation: RunView }>(
    await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ garmentId, promptId, look, clientKey }),
    }),
  );
  return { ...generation, promptId, look };
}

export async function listRuns(garmentId: string): Promise<RunView[]> {
  const { generations } = await json<{ generations: RunView[] }>(await fetch(`/api/garments/${garmentId}/generations`));
  return generations;
}

export async function listAll(): Promise<RunView[]> {
  const { generations } = await json<{ generations: RunView[] }>(await fetch("/api/generations?limit=100"));
  return generations;
}

export async function setVerdict(id: string, verdict: RunView["verdict"]): Promise<void> {
  await fetch(`/api/generations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ verdict }) });
}

export async function balance(): Promise<number> {
  const { balancePaise } = await json<{ balancePaise: number }>(await fetch("/api/account"));
  return balancePaise;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
