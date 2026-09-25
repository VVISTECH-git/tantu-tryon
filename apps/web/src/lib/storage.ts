import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2, for uploaded photographs, the labelled sheets and every
 * generated image.
 *
 * R2 because the bill that grows here is egress, and R2 serves for free.
 * `aws4fetch` rather than the AWS SDK: a few kilobytes against several
 * megabytes, on functions whose cold start is already paid for by a person
 * waiting for a picture.
 *
 * Two paths in:
 *   the browser PUTs an upload straight to R2 on a presigned URL, so the
 *   bytes never cross a Vercel function and its 4.5 MB body limit;
 *   the server PUTs what it made itself — sheets and renders.
 */

const ACCOUNT = process.env.R2_ACCOUNT_ID ?? "";
const BUCKET = process.env.R2_BUCKET ?? "";
const KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET = process.env.R2_SECRET_ACCESS_KEY ?? "";
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

export function storageConfigured(): boolean {
  return storageMissing().length === 0;
}

export function storageMissing(): string[] {
  return (
    [
      ["R2_ACCOUNT_ID", ACCOUNT],
      ["R2_BUCKET", BUCKET],
      ["R2_ACCESS_KEY_ID", KEY_ID],
      ["R2_SECRET_ACCESS_KEY", SECRET],
      ["R2_PUBLIC_BASE_URL", PUBLIC_BASE],
    ] as const
  )
    .filter(([, value]) => value === "")
    .map(([name]) => name);
}

export function publicUrl(key: string): string {
  return `${PUBLIC_BASE}/${key}`;
}

function objectUrl(key: string): string {
  return `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}/${key}`;
}

let client: AwsClient | null = null;
function aws(): AwsClient {
  if (!storageConfigured()) {
    throw new Error(`Storage is not configured: ${storageMissing().join(", ")} missing.`);
  }
  client ??= new AwsClient({ accessKeyId: KEY_ID, secretAccessKey: SECRET, service: "s3", region: "auto" });
  return client;
}

/**
 * A URL the browser can PUT one file to, for a few minutes.
 *
 * Bound to one key, one method and one content type. The browser's PUT must
 * send exactly that Content-Type or the signature fails — the caller passes
 * the same string to both.
 */
export async function presignPut(key: string, contentType: string, seconds = 300): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(seconds));
  const signed = await aws().sign(new Request(url, { method: "PUT", headers: { "content-type": contentType } }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

/** The server writing something it made. */
export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await aws().fetch(objectUrl(key), {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(bytes.byteLength), ...extraHeaders },
    body: bytes as BodyInit,
  });
  if (!res.ok) throw new Error(`R2 put ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return publicUrl(key);
}

/** Size and type of an object, or null when it is not there. Used to confirm a browser upload landed. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const res = await aws().fetch(objectUrl(key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 head ${res.status}`);
  return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") };
}

/** The bytes of an object we wrote or a merchant uploaded. */
export async function getObject(key: string): Promise<Uint8Array> {
  const res = await aws().fetch(objectUrl(key));
  if (!res.ok) throw new Error(`R2 get ${res.status} for ${key}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function remove(key: string): Promise<void> {
  await aws().fetch(objectUrl(key), { method: "DELETE" });
}

/**
 * Where things live. Browsable, so an orphan can be traced back to what it
 * belonged to; stamped, so a replacement is a new object rather than an
 * overwrite of one a CDN may still be serving.
 */
export const keys = {
  part: (garmentId: string, slot: string, extension: string) =>
    `garments/${garmentId}/${slot}-${Date.now()}.${extension}`,
  sheet: (garmentId: string, extension = "png") => `garments/${garmentId}/sheet-${Date.now()}.${extension}`,
  render: (garmentId: string, generationId: string, extension: string) =>
    `renders/${garmentId}/${generationId}.${extension}`,
};

/**
 * Where local files live when R2 is not configured. `next dev` may be started
 * from another directory, so the app's own public/ is named explicitly in
 * .env.local (TANTU_LOCAL_DIR); otherwise the working directory's public/.
 */
export function localRoot(): string {
  return process.env.TANTU_LOCAL_DIR || `${process.cwd()}/public`;
}

export function extensionFor(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

// ── Renders ───────────────────────────────────────────────────────────────────

/**
 * Where a generated image goes.
 *
 * R2 when configured. On a bare local checkout it is written under
 * public/dev-renders instead, with a `local:` key, so Phase 0 can run before
 * a bucket exists. Nothing in production should ever see a `local:` key.
 */
export async function saveRender(
  garmentId: string,
  generationId: string,
  bytes: Uint8Array,
  mime: string,
  filename?: string,
): Promise<string> {
  const extension = extensionFor(mime);
  if (storageConfigured()) {
    const key = keys.render(garmentId, generationId, extension);
    // Served with a download name: a cross-origin link ignores the anchor's
    // `download` attribute, so the object itself has to carry the filename.
    await putObject(key, bytes, mime, filename ? { "content-disposition": `attachment; filename="${filename}"` } : {});
    return key;
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(localRoot(), "dev-renders");
  await mkdir(dir, { recursive: true });
  const name = `${generationId}.${extension}`;
  await writeFile(path.join(dir, name), bytes);
  return `local:dev-renders/${name}`;
}

export function renderUrl(key: string): string {
  // Local files go through /api/assets: Next's dev server does not always
  // notice files added to public/ after it started.
  return key.startsWith("local:") ? `/api/assets/${key.slice("local:".length)}` : publicUrl(key);
}

/** Same rule for every stored thing: our R2 key, or a `local:` path under public/. */
export const assetUrl = renderUrl;

/**
 * A merchant's photograph sent through the server: the browser's upload, and
 * the phone's when storage is not configured. Stored as it arrived. The
 * phone's usual path is a presigned PUT straight to R2 (see the upload-url
 * route), because an untouched camera original can pass Vercel's 4.5 MB
 * request limit.
 */
export async function saveUpload(garmentId: string, slot: string, bytes: Uint8Array, mime: string): Promise<string> {
  const extension = extensionFor(mime);
  if (storageConfigured()) {
    const key = keys.part(garmentId, slot, extension);
    await putObject(key, bytes, mime);
    return key;
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(localRoot(), "dev-uploads", garmentId);
  await mkdir(dir, { recursive: true });
  const name = `${slot}-${Date.now()}.${extension}`;
  await writeFile(path.join(dir, name), bytes);
  return `local:dev-uploads/${garmentId}/${name}`;
}

/** The bytes behind a key, wherever it lives. */
export async function readAsset(key: string): Promise<Uint8Array> {
  if (key.startsWith("local:")) {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    return new Uint8Array(await readFile(path.join(localRoot(), key.slice("local:".length))));
  }
  return getObject(key);
}
