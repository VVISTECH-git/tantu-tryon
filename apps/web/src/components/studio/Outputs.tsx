"use client";

import { useEffect, useState } from "react";

/**
 * Where Gemini's answers come back to.
 *
 * Drop the generated image here, or copy it in Gemini and paste anywhere on
 * this page. It lands beside the prompt that made it and the product it was
 * made for, which is the only place it can be judged. Nothing leaves the
 * browser: the images are held in memory for this visit and named for saving
 * — 300021-P1-1.png — so a folder of outputs stays legible later.
 */
export interface Output {
  id: number;
  url: string;
  name: string;
  at: Date;
}

export function Outputs({
  code,
  promptId,
  outputs,
  onAdd,
  onRemove,
}: {
  code: string;
  promptId: string;
  outputs: Output[];
  onAdd: (file: File) => void;
  onRemove: (id: number) => void;
}) {
  const [over, setOver] = useState(false);

  // A paste anywhere on the page, when it carries an image, is an output.
  // Gemini's right-click → Copy image puts one on the clipboard.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        onAdd(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onAdd]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith("image/")) onAdd(file);
    }
  }

  function save(o: Output) {
    const a = document.createElement("a");
    a.href = o.url;
    a.download = o.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <section>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-5 py-6 text-center transition ${
          over ? "border-accent bg-accent-wash" : "border-line bg-surface"
        }`}
      >
        <p className="text-[14px] text-ink">Drop Gemini&rsquo;s output here</p>
        <p className="mt-1 text-[12.5px] text-ink-faint">
          Or copy the image in Gemini and paste anywhere on this page. Kept for this visit only; use Save
          to keep one.
        </p>
      </div>

      {outputs.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {outputs.map((o, i) => (
            <li key={o.id} className="m-0 list-none">
              <a href={o.url} target="_blank" rel="noopener" title="Open full size">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-line bg-surface">
                  {/* Object URLs are local and short-lived; next/image has nothing to optimise. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.url} alt={`${promptId} output ${i + 1} for ${code}`} className="h-full w-full object-cover" />
                </div>
              </a>
              <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-soft">
                <span className="tabular-nums">
                  {promptId} · {i + 1}
                </span>
                <span className="text-ink-faint">
                  {o.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  type="button"
                  onClick={() => save(o)}
                  className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-[12px] transition hover:border-ink-faint hover:text-ink"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(o.id)}
                  aria-label="Remove"
                  className="rounded-full border border-line px-2 py-0.5 text-[12px] transition hover:border-danger hover:text-danger"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
