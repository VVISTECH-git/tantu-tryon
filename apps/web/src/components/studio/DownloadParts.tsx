"use client";

import Image from "next/image";
import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { REQUIRED_SLOTS, type ChosenProduct } from "./types";

/**
 * The four photographs, as files.
 *
 * Links were not enough: the tools these prompts are written for cannot fetch a
 * URL, so a page full of addresses left the actual work — get the files —
 * still to do. The link stays for anyone who wants it; the download is what
 * the job needs.
 *
 * Downloads are fired one at a time with a gap. Browsers treat a burst of
 * saves from one gesture as suspicious and block all but the first.
 */
export function DownloadParts({ product }: { product: ChosenProduct }) {
  const [busy, setBusy] = useState(false);

  const present = REQUIRED_SLOTS.map((slot) => ({
    slot,
    part: product.parts.find((p) => p.slot === slot),
  })).filter((row) => row.part !== undefined);

  function save(slot: string) {
    if (!product.code) return;
    const a = document.createElement("a");
    a.href = `/api/products/${product.code}/image/${slot}`;
    a.download = `${product.code}-${slot}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function saveAll() {
    setBusy(true);
    for (const row of present) {
      save(row.slot);
      await new Promise((r) => setTimeout(r, 700));
    }
    setBusy(false);
  }

  const links = present.map((r) => `${r.slot}: ${r.part!.src}`).join("\n");

  return (
    <section className="mt-10 border-t border-line pt-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="display text-[20px]">Photographs</h2>
        <div className="ml-auto flex gap-2">
          <CopyButton text={links} label="Copy links" />
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={busy || !product.code}
            className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
          >
            {busy ? "Saving…" : `Download all ${present.length}`}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-ink-faint">
        Gemini cannot open a link — download these and attach the files.
      </p>

      <ul className="mt-4 divide-y divide-line-soft border-y border-line-soft">
        {present.map(({ slot, part }) => (
          <li key={slot} className="flex items-center gap-3 py-2.5">
            <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-line">
              <Image src={part!.src} alt={part!.alt} fill sizes="44px" className="object-cover" />
            </span>
            <span className="w-16 shrink-0 text-[13px] capitalize text-ink">{slot}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">
              {product.code ? `${product.code}-${slot}.png` : part!.label}
            </span>
            {product.code && (
              <button
                type="button"
                onClick={() => save(slot)}
                className="rounded-full border border-line px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
              >
                Download
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
