import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { localRoot } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Local development only: serves what `saveUpload` and `saveRender` wrote
 * under public/dev-uploads and public/dev-renders.
 *
 * Next's dev server does not always notice files added to `public` after it
 * started, and production never has these files at all — there, everything
 * is in R2 and `assetUrl` points straight at it.
 */
const ROOTS = new Set(["dev-uploads", "dev-renders"]);
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const [root, ...rest] = segments;
  if (!root || !ROOTS.has(root) || rest.length === 0 || rest.some((s) => s.includes("..") || s.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }
  const base = path.join(localRoot(), root);
  const file = path.join(base, ...rest);
  if (!file.startsWith(base)) return new Response("Not found", { status: 404 });

  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const bytes = await readFile(file);
    const extension = file.split(".").pop()?.toLowerCase() ?? "";
    return new Response(bytes, {
      headers: {
        "Content-Type": TYPES[extension] ?? "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
