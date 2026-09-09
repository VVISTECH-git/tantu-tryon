"use client";

import Image from "next/image";
import { useState } from "react";
import {
  TEMPLATES,
  composePrompt,
  type GarmentWords,
  type Selections,
} from "@/content/promptTemplates";
import { CopyButton } from "./CopyButton";
import { REQUIRED_SLOTS, missingSlots, type ChosenProduct } from "./types";

/**
 * What you take away, on the right.
 *
 * Empty until a product is found. Then, top to bottom: the product and what
 * SLK knows about it, its four photographs, the downloads, and the prompts —
 * as buttons, one prompt shown at a time, rewritten live from the choices on
 * the left.
 */
export function Result({
  product,
  selections,
}: {
  product: ChosenProduct;
  selections: Selections;
}) {
  const [active, setActive] = useState(TEMPLATES.find((t) => t.live)?.id ?? "P1");
  const [saving, setSaving] = useState(false);

  const d = product.design;
  const garment: GarmentWords = {
    fibre: d?.fibreType?.toLowerCase() ?? null,
    type: d?.productType?.toLowerCase() ?? "saree",
  };

  const template = TEMPLATES.find((t) => t.id === active) ?? TEMPLATES[0]!;
  const prompt = template.live ? composePrompt(template, garment, selections) : "";
  const gaps = missingSlots(product);

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
    setSaving(true);
    for (const part of product.parts) {
      save(part.slot);
      // One at a time: a burst of saves from a single gesture gets blocked.
      await new Promise((r) => setTimeout(r, 700));
    }
    setSaving(false);
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">{product.title}</h1>
          {product.code && <span className="text-[14px] tabular-nums text-ink-faint">{product.code}</span>}
        </div>

        {d && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13.5px] sm:grid-cols-[auto_1fr_auto_1fr]">
            <Fact k="Design">{d.code}</Fact>
            <Fact k="Colour">{d.colour}</Fact>
            <Fact k="Motif">{d.motif}</Fact>
            <Fact k="Fibre">{d.fibreType}</Fact>
            <Fact k="Craft">{[d.craftTechnique, d.craftSubType].filter(Boolean).join(" · ") || null}</Fact>
            <Fact k="Weave">{d.weaveStructure}</Fact>
            <Fact k="Pallu">{d.palluMotif}</Fact>
            <Fact k="Border">{[d.borderMotif, d.borderHeight].filter(Boolean).join(" · ") || null}</Fact>
            <Fact k="Blouse">{[d.blouseStyle, d.blouseMotif].filter(Boolean).join(" · ") || null}</Fact>
            <Fact k="For">{d.audienceType}</Fact>
          </dl>
        )}

        {product.description ? (
          <p className="mt-4 max-w-prose text-[14.5px] leading-relaxed text-ink-soft">{product.description}</p>
        ) : (
          <p className="mt-4 text-[13px] text-ink-faint">No description written for this product in SLK.</p>
        )}
      </section>

      <section>
        {gaps.length > 0 && (
          <p className="mb-3 rounded-xl border border-madder/35 bg-madder/5 px-4 py-2.5 text-[13.5px] text-madder">
            Not photographed yet: {gaps.join(", ")}.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {REQUIRED_SLOTS.map((slot) => {
            const part = product.parts.find((p) => p.slot === slot);
            return (
              <figure key={slot} className="m-0">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-surface">
                  {part ? (
                    <Image src={part.src} alt={part.alt} fill sizes="240px" className="object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-[12px] text-ink-faint">missing</span>
                  )}
                </div>
                <figcaption className="mt-1.5 flex items-center text-[13px] capitalize text-ink-soft">
                  {slot}
                  {part && product.code && (
                    <button
                      type="button"
                      onClick={() => save(slot)}
                      className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-[12px] normal-case text-ink-soft transition hover:border-ink-faint hover:text-ink"
                    >
                      Save
                    </button>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>

        {product.code && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={saving}
              className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-accent-hover disabled:bg-surface-3 disabled:text-ink-soft"
            >
              {saving ? "Saving…" : `Download all ${product.parts.length}`}
            </button>
            <span className="text-[12.5px] text-ink-faint">
              Originals, unresized. Gemini needs the files attached, not a link.
            </span>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!t.live}
              onClick={() => setActive(t.id)}
              aria-pressed={active === t.id}
              title={t.live ? t.title : "Not written yet"}
              className={`rounded-lg border px-4 py-2 text-[14px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                active === t.id
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink"
              }`}
            >
              Prompt {t.id.slice(1)}
            </button>
          ))}
        </div>

        <article className="mt-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full bg-accent-wash px-2 py-0.5 text-[12px] font-semibold tabular-nums text-accent">
              {template.id}
            </span>
            <h2 className="text-[15px] font-semibold text-ink">{template.title}</h2>
            <CopyButton text={prompt} className="ml-auto" />
          </div>
          <p className="mt-1.5 text-[13px] text-ink-faint">{template.summary}</p>
          <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-[1.75] text-ink-soft">{prompt}</p>
        </article>
      </section>
    </div>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <>
      <dt className="text-ink-faint">{k}</dt>
      <dd className="m-0 text-ink">{children}</dd>
    </>
  );
}
