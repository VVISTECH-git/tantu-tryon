"use client";

import { useState } from "react";
import { EXPECTED_PROMPTS, STUDIO_PROMPTS } from "@/content/studioPrompts";
import { CopyButton } from "./CopyButton";
import { ProductRail } from "./ProductRail";
import type { ChosenProduct } from "./types";

/**
 * One page: what you set on the left, what you take on the right.
 *
 * Tantu does not generate here and spends nothing. It finds the saree, gives
 * you its photographs as files, and composes the prompts — the generation
 * happens wherever you paste them.
 *
 * No pose picker. The poses are a decision made once rather than a question
 * asked of whoever is holding the saree, and every product gets the same set so
 * the catalogue stays comparable.
 *
 * Headings here are set in the body face, not the display serif. Prata is a
 * high-contrast Didone: beautiful at 40px on a marketing page, and at 15px it
 * loses its thin strokes and reads like a page printed with a failing
 * cartridge. A working screen is read all day and needs a face that holds up.
 */
export function Studio() {
  const [product, setProduct] = useState<ChosenProduct | null>(null);

  const allPrompts = STUDIO_PROMPTS.map((p) => `${p.id} — ${p.title}\n\n${p.text}`).join(
    "\n\n———\n\n",
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <ProductRail product={product} onChange={setProduct} />
      </aside>

      <main className="min-w-0">
        <header className="border-b border-line pb-4">
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">Prompts</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            Copy one, attach the saree photographs, and generate wherever you
            like. Nothing is generated or charged here.
          </p>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-ink-faint">
            {STUDIO_PROMPTS.length} of {EXPECTED_PROMPTS} written
          </span>
          <CopyButton text={allPrompts} label="Copy all" className="ml-auto" />
        </div>

        <div className="mt-4 space-y-4">
          {STUDIO_PROMPTS.map((prompt, i) => (
            <article key={prompt.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-full bg-accent-wash px-2 py-0.5 text-[12px] font-semibold tabular-nums text-accent">
                  {prompt.id}
                </span>
                <h2 className="text-[15px] font-semibold text-ink">{prompt.title}</h2>
                {i === 0 && (
                  <span className="text-[12px] text-ink-faint">start here</span>
                )}
                <CopyButton text={prompt.text} className="ml-auto" />
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">{prompt.summary}</p>
              <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-[1.75] text-ink-soft">
                {prompt.text}
              </p>
            </article>
          ))}
        </div>

        {STUDIO_PROMPTS.length < EXPECTED_PROMPTS && (
          /*
            Said rather than left short. Four is the intended set, and a page
            quietly showing two looks finished when it is not.
          */
          <p className="mt-5 rounded-xl border border-madder/35 bg-madder/5 px-4 py-3 text-[13.5px] text-madder">
            {EXPECTED_PROMPTS - STUDIO_PROMPTS.length} more still to be written.
            This is not the full set yet.
          </p>
        )}
      </main>
    </div>
  );
}
