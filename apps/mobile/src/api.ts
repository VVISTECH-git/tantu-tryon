import Constants from "expo-constants";
import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import type { GarmentView, GenerationLookView, RunView, UploadResult } from "@tantu/shared/views";

/**
 * The phone's calls to the same server the browser uses.
 *
 * Sign-in returns a bearer token, kept in the phone's secure store and sent
 * on every request; the server treats it exactly like the browser's cookie.
 * The base URL comes from app.json (production) unless EXPO_PUBLIC_API_BASE
 * overrides it, which is how the app points at a laptop during development.
 */

const TOKEN_KEY = "tantu.session";

export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ??
  ((Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ?? "https://tantu-tryon.vercel.app");

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

async function storeToken(value: string | null): Promise<void> {
  token = value;
  try {
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // The token still lives for this run; the next launch asks for the passcode again.
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-tantu-client", "mobile");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(payload.error ?? `Request failed (${response.status}).`, response.status);
  return payload;
}

export async function login(username: string, password: string): Promise<{ name: string; role: string }> {
  const out = await call<{ ok: true; account: { id: string; name: string; role?: string }; token?: string }>("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!out.token) throw new ApiError("The server did not return a session for the phone.", 500);
  await storeToken(out.token);
  return { name: out.account.name, role: out.account.role ?? "admin" };
}

export async function logout(): Promise<void> {
  try {
    await call("/api/auth/logout", { method: "POST" });
  } finally {
    await storeToken(null);
  }
}

export async function account(): Promise<{ name: string; username: string | null; role: string; balancePaise: number }> {
  const out = await call<{ account: { name: string; username?: string | null; role?: string }; balancePaise: number }>("/api/account");
  return { name: out.account.name, username: out.account.username ?? null, role: out.account.role ?? "admin", balancePaise: out.balancePaise };
}

export interface LocalPhoto {
  uri: string;
  width: number;
  height: number;
  /** "image/jpeg" from the camera; the library may hand back PNG or HEIC. */
  mimeType?: string;
}

/** One photograph into its slot. The file goes as multipart, the way the browser sends it. */
/**
 * The photo exactly as the camera made it: asked for an upload URL, PUT
 * straight to storage (an original can pass the 4.5 MB a server request may
 * carry), then recorded. Falls back to the multipart route where the server
 * has no storage to hand out URLs for.
 */
export async function uploadPart(photo: LocalPhoto, slot: string, garmentId: string | null, type: string): Promise<UploadResult> {
  const contentType = photo.mimeType ?? "image/jpeg";
  let target: { garmentId: string; key: string; url: string };
  try {
    target = await call("/api/garments/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, type, garmentId, contentType }),
    });
  } catch (error) {
    // 501: no storage here. 404: a server from before direct uploads.
    if (error instanceof ApiError && (error.status === 501 || error.status === 404)) return uploadThroughServer(photo, slot, garmentId, type);
    throw error;
  }
  // Straight to storage, with no Authorization header: the URL carries its own signature.
  const put = await fetch(target.url, { method: "PUT", headers: { "content-type": contentType }, body: new File(photo.uri) as unknown as Blob });
  if (!put.ok) throw new ApiError(`The photo could not be sent (${put.status}). Please try again.`, put.status);
  return call<UploadResult>("/api/garments/upload-done", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ garmentId: target.garmentId, slot, key: target.key }),
  });
}

async function uploadThroughServer(photo: LocalPhoto, slot: string, garmentId: string | null, type: string): Promise<UploadResult> {
  const form = new FormData();
  // Expo's fetch wants a real File for a multipart part, not the old {uri} descriptor.
  form.append("file", new File(photo.uri) as unknown as Blob, `${slot}.jpg`);
  form.append("slot", slot);
  form.append("type", type);
  if (garmentId) form.append("garmentId", garmentId);
  return call<UploadResult>("/api/garments/upload", { method: "POST", body: form });
}

/** Open (or reopen) the record for one product ID; every photograph after this is saved against it. */
export async function openProduct(productId: string, type: string): Promise<GarmentView> {
  const out = await call<{ garment: GarmentView }>("/api/garments/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, type }),
  });
  return out.garment;
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
}

export async function savedProducts(): Promise<SavedProduct[]> {
  const out = await call<{ products: SavedProduct[] }>("/api/garments");
  return out.products;
}

export async function getGarment(id: string): Promise<GarmentView> {
  const out = await call<{ garment: GarmentView }>(`/api/garments/${id}`);
  return out.garment;
}

/** Give a record made before product IDs were asked for its ID. */
export async function setProductId(id: string, productId: string): Promise<GarmentView> {
  const out = await call<{ garment: GarmentView }>(`/api/garments/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productCode: productId }),
  });
  return out.garment;
}

export async function removePart(id: string, slot: string): Promise<GarmentView> {
  const out = await call<{ garment: GarmentView }>(`/api/garments/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ removeSlots: [slot] }),
  });
  return out.garment;
}

export interface Analysis {
  garment: GarmentView;
  warnings: { title: string; body: string }[];
  readerError: string | null;
}

export async function analyze(id: string): Promise<Analysis> {
  return call<Analysis>(`/api/garments/${id}/analyze`, { method: "POST" });
}

export async function generate(garmentId: string, promptId: string, look: GenerationLookView, clientKey: string): Promise<RunView> {
  const out = await call<{ generation: RunView }>("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ garmentId, promptId, look, clientKey }),
  });
  return { ...out.generation, promptId, look };
}

export async function listRuns(garmentId: string): Promise<RunView[]> {
  const out = await call<{ generations: RunView[] }>(`/api/garments/${garmentId}/generations`);
  return out.generations;
}

export function rupees(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

export function newKey(): string {
  // crypto.randomUUID is not on every RN runtime; a time-and-random key is unique enough per attempt.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}
