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

/**
 * One photograph into its slot, the way the phone sends it (7 Oct): the file
 * exactly as the camera made it goes straight to storage on a signed URL (an
 * original can pass the 4.5 MB a server request may carry), with a 1600 px
 * screen copy beside it, then the server records it. Where storage refuses
 * the browser (no CORS rule yet, or no storage at all), the photo goes through
 * the server at ~2000 px instead, and the rest of this visit does the same.
 */
let directBlocked = false;

export async function uploadPart(file: File, slot: string, garmentId: string | null, type: string, brightness = 0): Promise<UploadResult> {
  if (!directBlocked) {
    try {
      return await uploadDirect(file, slot, garmentId, type, brightness);
    } catch (error) {
      if (!(error instanceof DirectUploadUnavailable)) throw error;
      directBlocked = true;
    }
  }
  return uploadThroughServer(file, slot, garmentId, type);
}

class DirectUploadUnavailable extends Error {}

async function uploadDirect(file: File, slot: string, garmentId: string | null, type: string, brightness = 0): Promise<UploadResult> {
  const contentType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const asked = await fetch("/api/garments/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json", "x-tantu-device": deviceId() },
    body: JSON.stringify({ slot, type, garmentId, contentType, withPreview: true }),
  });
  if (asked.status === 501 || asked.status === 404) throw new DirectUploadUnavailable();
  const target = await json<{ garmentId: string; key: string; url: string; previewKey?: string; previewUrl?: string }>(asked);
  // Straight to storage; a CORS refusal surfaces as a network error, not a status.
  const put = await fetch(target.url, { method: "PUT", headers: { "content-type": contentType }, body: file }).catch(() => null);
  if (!put) throw new DirectUploadUnavailable();
  if (!put.ok) throw new Error(`The photo could not be sent (${put.status}). Please try again.`);
  let previewKey: string | undefined;
  if (target.previewUrl && target.previewKey) {
    try {
      const small = await loadImageFile(file, 1600);
      const blob = await (await fetch(small.dataUrl)).blob();
      const sent = await fetch(target.previewUrl, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob }).catch(() => null);
      if (sent?.ok) previewKey = target.previewKey;
    } catch {
      // No preview: the server reads the original instead.
    }
  }
  return json<UploadResult>(
    await fetch("/api/garments/upload-done", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Brightness the browser could not apply itself: the server applies it to the photo.
      body: JSON.stringify({ garmentId: target.garmentId, slot, key: target.key, previewKey, ...(brightness ? { brightness } : {}) }),
    }),
  );
}

async function uploadThroughServer(file: File, slot: string, garmentId: string | null, type: string): Promise<UploadResult> {
  // Resized in the browser to ~2000 px, upright and under the server's request limit.
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

/** One run as it stands now: polled while the laptop makes it. */
export async function getRun(id: string): Promise<RunView> {
  const { generation } = await json<{ generation: RunView }>(await fetch(`/api/generations/${id}`, { cache: "no-store" }));
  return generation;
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
