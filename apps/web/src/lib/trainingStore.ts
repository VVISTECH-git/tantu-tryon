import { AwsClient } from "aws4fetch";

/**
 * The training data bucket (5 Oct): a separate, private Cloudflare R2 account
 * holding the shop photos copied for training (iTokri, Shobitam, Holy Weaves),
 * one folder per product:
 *
 *   <shop>/<product id>/product.json   title, link, description
 *   <shop>/<product id>/kinds.json     { "01.jpg": "full" | "fabric" | "poster", ... }
 *   <shop>/<product id>/01.jpg ...     the photos
 *
 * Kept apart from Tantu's own storage (lib/storage.ts) on purpose.
 */

const ACCOUNT = process.env.TRAIN_R2_ACCOUNT_ID ?? "";
const BUCKET = process.env.TRAIN_R2_BUCKET ?? "sareeai-training";
const KEY_ID = process.env.TRAIN_R2_ACCESS_KEY_ID ?? "";
const SECRET = process.env.TRAIN_R2_SECRET_ACCESS_KEY ?? "";

export const TRAINING_SHOPS = ["itokri", "shobitam", "holyweaves"] as const;
export const PHOTO_KINDS = ["full", "fabric", "poster"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export function trainingConfigured(): boolean {
  return Boolean(ACCOUNT && KEY_ID && SECRET);
}

let client: AwsClient | null = null;
function aws(): AwsClient {
  if (!trainingConfigured()) throw new Error("The training bucket is not set up (TRAIN_R2_* settings missing).");
  client ??= new AwsClient({ accessKeyId: KEY_ID, secretAccessKey: SECRET, service: "s3", region: "auto" });
  return client;
}

const base = () => `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}`;
const objectUrl = (key: string) => `${base()}/${key.split("/").map(encodeURIComponent).join("/")}`;

function tags(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]!.replace(/&amp;/g, "&"));
}

/** The folders directly under a prefix (each product of a shop), every page of the listing. */
export async function listFolders(prefix: string): Promise<string[]> {
  const out: string[] = [];
  let token: string | null = null;
  do {
    const url = new URL(base());
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("delimiter", "/");
    url.searchParams.set("max-keys", "1000");
    if (token) url.searchParams.set("continuation-token", token);
    const res = await aws().fetch(url.toString());
    if (!res.ok) throw new Error(`Training bucket list ${res.status}`);
    const xml = await res.text();
    for (const p of tags(xml, "Prefix").filter((p) => p !== prefix && p.startsWith(prefix))) out.push(p.slice(prefix.length).replace(/\/$/, ""));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (tags(xml, "NextContinuationToken")[0] ?? null) : null;
  } while (token);
  return out;
}

/** The files in one folder (a product's photos and its json files). */
export async function listFiles(prefix: string): Promise<{ name: string; size: number }[]> {
  const url = new URL(base());
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix);
  url.searchParams.set("max-keys", "1000");
  const res = await aws().fetch(url.toString());
  if (!res.ok) throw new Error(`Training bucket list ${res.status}`);
  const xml = await res.text();
  const keys = tags(xml, "Key");
  const sizes = tags(xml, "Size").map(Number);
  return keys.map((k, i) => ({ name: k.slice(prefix.length), size: sizes[i] ?? 0 }));
}

export async function readJson<T>(key: string): Promise<T | null> {
  const res = await aws().fetch(objectUrl(key));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Training bucket get ${res.status} for ${key}`);
  return (await res.json()) as T;
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  // Bytes with their length stated: R2 refuses a PUT whose length it is not told (411).
  const body = new TextEncoder().encode(JSON.stringify(value, null, 1));
  const res = await aws().fetch(objectUrl(key), {
    method: "PUT",
    headers: { "content-type": "application/json", "content-length": String(body.byteLength) },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`Training bucket put ${res.status} for ${key}`);
}

/** A link that shows one private photo for an hour. */
export async function photoLink(key: string, seconds = 3600): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(seconds));
  const signed = await aws().sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
  return signed.url;
}

export interface TrainingProduct {
  id: string;
  title: string | null;
  url: string | null;
  photos: string[];
  /** Photos with a small copy in _small/ (480 px), for showing many at once. */
  small: Set<string>;
  kinds: Record<string, PhotoKind>;
}

/** The small copy's key when there is one, else the photo itself. */
export function previewKey(shop: string, p: TrainingProduct, photo: string): string {
  const small = `_small/${photo.replace(/\.[a-z0-9]+$/i, "")}.jpg`;
  return `${shop}/${p.id}/${p.small.has(photo) ? small : photo}`;
}

/** One product: its details, photo names and their kinds. */
export async function readProduct(shop: string, id: string): Promise<TrainingProduct | null> {
  const prefix = `${shop}/${id}/`;
  const [files, meta, kinds] = await Promise.all([
    listFiles(prefix),
    readJson<{ title?: string; url?: string }>(`${prefix}product.json`),
    readJson<Record<string, PhotoKind>>(`${prefix}kinds.json`),
  ]);
  const names = files.map((f) => f.name);
  const photos = names.filter((n) => /^\d\d\.(jpe?g|png|webp|gif)$/i.test(n)).sort();
  const smallOnes = new Set(names.filter((n) => n.startsWith("_small/")).map((n) => n.slice(7).replace(/\.jpg$/, "")));
  const small = new Set(photos.filter((n) => smallOnes.has(n.replace(/\.[a-z0-9]+$/i, ""))));
  if (photos.length === 0 && !meta) return null;
  return { id, title: meta?.title ?? null, url: meta?.url ?? null, photos, small, kinds: kinds ?? {} };
}
