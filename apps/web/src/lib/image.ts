"use client";

/**
 * Reference photographs are resized in the browser before they are sent.
 *
 * It means a 40MP phone photo straight off the floor is fine — no 5MB upload
 * ceiling to explain to whoever is holding the camera — and the request stays
 * small enough that five poses do not time out on a slow connection.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.92;

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
  originalBytes: number;
  bytes: number;
}

export async function loadImageFile(file: File, maxEdge = MAX_EDGE): Promise<LoadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not an image.`);
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read the image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // JPEG unless the source had transparency worth keeping.
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(type, QUALITY);

  return {
    dataUrl,
    width,
    height,
    originalBytes: file.size,
    bytes: Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75),
  };
}

export async function thumbnail(dataUrl: string, size = 240): Promise<string> {
  const image = await loadHtmlImage(dataUrl);
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image."));
    image.src = src;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Re-frames a render to a marketplace's required aspect ratio on white, so a
 * catalogue image does not have to make a round trip through Canva before it
 * can be listed.
 */
export async function reframe(
  dataUrl: string,
  ratio: number,
  background = "#ffffff",
  longEdge = 2000,
): Promise<string> {
  const image = await loadHtmlImage(dataUrl);
  const width = ratio >= 1 ? longEdge : Math.round(longEdge * ratio);
  const height = ratio >= 1 ? Math.round(longEdge / ratio) : longEdge;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.94);
}

export const EXPORT_PRESETS = [
  { id: "square", label: "Square · Amazon, Flipkart", ratio: 1 },
  { id: "portrait", label: "4:5 · Instagram, Shopify", ratio: 4 / 5 },
  { id: "story", label: "9:16 · Story, Reel", ratio: 9 / 16 },
  { id: "wide", label: "16:9 · Banner", ratio: 16 / 9 },
] as const;
