"use client";

import { useState } from "react";
import { EXPECTED_PROMPTS, STUDIO_PROMPTS } from "@/content/studioPrompts";
import { CopyButton } from "./CopyButton";
import { DownloadParts } from "./DownloadParts";
import { StepProduct } from "./StepProduct";
import type { ChosenProduct } from "./types";

/**
 * One screen: find the saree, take the prompts.
 *
 * Tantu does not generate here and does not spend anything. It composes the
 * four prompts and hands over the photograph links, and the generation happens
 * wherever the operator chooses to paste them.
 *
 * There is no pose picker. The four poses are a decision made once, not a
 * question asked of whoever is holding the saree — and every product gets all
 * four, so the set stays comparable across the catalogue.
 */
export function Studio() {
  const [product, setProduct] = useState<ChosenProduct | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-6 py-9">
      <header>
        <p className="label !text-madder">Prompts, not renders</p>
        <h1 className="display mt-1 text-[28px]">Studio</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          Find the saree, download its photographs, and take the four prompts.
          Paste them wherever you generate. Nothing is generated or charged
          here.
        </p>
      </header>

      <section className="mt-8">
        <StepProduct product={product} onChange={setProduct} />
      </section>

      {product && (
        <>
          <DownloadParts product={product} />

          <section className="mt-10 border-t border-line pt-8">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="display text-[20px]">Prompts</h2>
              <span className="text-[13px] text-ink-faint">
                {STUDIO_PROMPTS.length} of {EXPECTED_PROMPTS}
              </span>
              <CopyButton
                text={STUDIO_PROMPTS.map((p) => `${p.id} — ${p.title}\n\n${p.text}`).join("\n\n———\n\n")}
                label="Copy all prompts"
                className="ml-auto"
              />
            </div>

            <div className="mt-5 space-y-5">
              {STUDIO_PROMPTS.map((prompt) => (
                <article key={prompt.id} className="rounded-xl border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="numeral text-[12px] text-madder">{prompt.id}</span>
                    <h3 className="text-[16px] font-medium">{prompt.title}</h3>
                    <CopyButton text={prompt.text} className="ml-auto" />
                  </div>
                  <p className="mt-1 text-[13px] text-ink-faint">{prompt.summary}</p>
                  <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
                    {prompt.text}
                  </p>
                </article>
              ))}
            </div>

            {STUDIO_PROMPTS.length < EXPECTED_PROMPTS && (
              /*
                Said rather than left short. Four is the intended set, and a
                page quietly showing two looks finished when it is not.
              */
              <p className="mt-5 rounded-xl border border-madder/35 bg-madder/5 px-4 py-3 text-[14px] text-madder">
                {EXPECTED_PROMPTS - STUDIO_PROMPTS.length} more prompt
                {EXPECTED_PROMPTS - STUDIO_PROMPTS.length === 1 ? "" : "s"} still
                to be written. This is not the full set yet.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
