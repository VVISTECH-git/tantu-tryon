"use client";

import { useState } from "react";

/**
 * A product's photos as one image: Copy (to paste into Gemini) or Download.
 * The browser can only copy PNG, so the JPEG is redrawn as PNG to copy it.
 */
export function Combined({ id, code, compact = false }: { id: string; code: string; compact?: boolean }) {
  const [state, setState] = useState<"" | "busy" | "copied" | "failed">("");
  const url = `/api/platform/products/${id}/combined`;

  const copy = async () => {
    setState("busy");
    try {
      const png = (async () => {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const bmp = await createImageBitmap(await res.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext("2d")!.drawImage(bmp, 0, 0);
        return new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error())), "image/png"));
      })();
      // Handing the clipboard a promise keeps Safari and Chrome happy with the wait.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setState("copied");
      setTimeout(() => setState(""), 2500);
    } catch {
      setState("failed");
    }
  };

  if (compact) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1 text-[12.5px]">
        <button type="button" onClick={() => void copy()} disabled={state === "busy"} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white disabled:opacity-60">
          {state === "busy" ? "Making it…" : state === "copied" ? "Copied: paste in Gemini" : "Export"}
        </button>
        <a href={url} download={`${code}-combined.jpg`} className="text-accent underline">
          Download
        </a>
        {state === "failed" && <span className="text-danger">Could not copy. Use Download.</span>}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
      <span className="text-ink-soft">Combined image:</span>
      <button type="button" onClick={() => void copy()} disabled={state === "busy"} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white disabled:opacity-60">
        {state === "busy" ? "Making it…" : state === "copied" ? "Copied: paste it into Gemini" : "Copy"}
      </button>
      <a href={url} download={`${code}-combined.jpg`} className="text-accent underline">
        Download
      </a>
      <a href={url} target="_blank" rel="noreferrer" className="text-accent underline">
        View
      </a>
      {state === "failed" && <span className="text-danger">Could not copy. Use Download instead.</span>}
    </div>
  );
}
