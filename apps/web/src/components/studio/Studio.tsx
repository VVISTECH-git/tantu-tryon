"use client";

import Image from "next/image";
import { useState } from "react";
import { EXPECTED_PROMPTS, STUDIO_PROMPTS } from "@/content/studioPrompts";
import { CopyButton } from "./CopyButton";
import { StepProduct } from "./StepProduct";
import { REQUIRED_SLOTS, type ChosenProduct } from "./types";

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

  const links = product
    ? REQUIRED_SLOTS.map((slot) => {
        const part = product.parts.find((p) => p.slot === slot);
        return part ? `${slot}: ${part.src}` : null;
      })
        .filter((line): line is string => line !== null)
        .join("\n")
    : "";

  return (
    <div className="mx-auto max-w-4xl px-6 py-9">
      <header>
        <p className="label !text-madder">Prompts, not renders</p>
        <h1 className="display mt-1 text-[28px]">Studio</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          Find the saree, then take the four prompts and its photograph links.
          Paste them wherever you generate. Nothing is generated or charged
          here.
        </p>
      </header>

      <section className="mt-8">
        <StepProduct product={product} onChange={setProduct} />
      </section>

      {product && (
        <>
          {product.parts.some((p) => p.src.startsWith("http")) && (
            <section className="mt-10 border-t border-line pt-8">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="display text-[20px]">Photograph links</h2>
                <CopyButton text={links} label="Copy all links" className="ml-auto" />
              </div>
              <p className="mt-1 text-[13px] text-ink-faint">
                Open each one and save it, then attach the files where you
                generate.
              </p>

              <ul className="mt-4 divide-y divide-line-soft border-y border-line-soft">
                {REQUIRED_SLOTS.map((slot) => {
                  const part = product.parts.find((p) => p.slot === slot);
                  if (!part) return null;
                  return (
                    <li key={slot} className="flex items-center gap-3 py-2.5">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-line">
                        <Image src={part.src} alt={part.alt} fill sizes="44px" className="object-cover" />
                      </span>
                      <span className="w-16 shrink-0 text-[13px] capitalize text-ink">{slot}</span>
                      <a
                        href={part.src}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-[12px] text-ink-faint underline underline-offset-2 hover:text-accent"
                      >
                        {part.src}
                      </a>
                      <CopyButton text={part.src} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

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
