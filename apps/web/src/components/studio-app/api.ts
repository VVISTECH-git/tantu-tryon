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
  patch: { words?: Record<string, string>; answers?: Record<string, boolean>; rotations?: Record<string, number> },
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
