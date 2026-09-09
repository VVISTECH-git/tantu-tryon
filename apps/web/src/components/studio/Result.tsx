"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TEMPLATES,
  composePrompt,
  type GarmentWords,
  type Selections,
} from "@/content/promptTemplates";
import { CopyButton } from "./CopyButton";
import { GeminiButton } from "./GeminiButton";
import { Outputs, type Output } from "./Outputs";
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

  /*
    The sheet, fetched once per product and held as a blob. The Gemini button
    needs it in hand — a clipboard write has to happen inside the click — and
    Download sheet can then serve it without a second build on the server.
  */
  const [fetched, setFetched] = useState<{ code: string; blob: Blob } | null>(null);
  const sheet = fetched && fetched.code === product.code ? fetched.blob : null;
  useEffect(() => {
    const code = product.code;
    if (!code) return;
    const controller = new AbortController();
    fetch(`/api/products/${code}/sheet`, { signal: controller.signal })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !controller.signal.aborted) setFetched({ code, blob });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [product.code]);

  // Gemini's answers, per prompt, for this visit. Object URLs are revoked on
  // removal and when the product changes; nothing is stored anywhere.
  const [outputs, setOutputs] = useState<Record<string, Output[]>>({});
  const nextId = useRef(1);
  useEffect(() => {
    return () => {
      Object.values(outputs)
        .flat()
        .forEach((o) => URL.revokeObjectURL(o.url));
    };
    // Only on unmount / product change: revoking on every add would kill live previews.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.code]);

  const addOutput = useCallback(
    (file: File) => {
      setOutputs((prev) => {
        const list = prev[active] ?? [];
        const id = nextId.current++;
        const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
        return {
          ...prev,
          [active]: [
            ...list,
            {
              id,
              url: URL.createObjectURL(file),
              name: `${product.code}-${active}-${list.length + 1}.${ext}`,
              at: new Date(),
            },
          ],
        };
      });
    },
    [active, product.code],
  );

  function removeOutput(id: number) {
    setOutputs((prev) => {
      const list = prev[active] ?? [];
      const gone = list.find((o) => o.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return { ...prev, [active]: list.filter((o) => o.id !== id) };
    });
  }

  const d = product.design;
  const garment: GarmentWords = {
    fibre: d?.fibreType?.toLowerCase() ?? null,
    type: d?.productType?.toLowerCase() ?? "saree",
  };

  /*
    The files the prompt will be pasted alongside, named exactly as the
    download names them. Listed in the order a person reads a saree — body,
    pallu, border, blouse — not the order SLK happened to return them.
  */
  const files = product.code
    ? REQUIRED_SLOTS.filter((slot) => product.parts.some((p) => p.slot === slot)).map((slot) => ({
        slot,
        file: `${product.code}-${slot}.png`,
      }))
    : [];

  const template = TEMPLATES.find((t) => t.id === active) ?? TEMPLATES[0]!;
  const prompt = template.live ? composePrompt(template, garment, selections, files) : "";
  const gaps = missingSlots(product);
  const sheetMode = selections.attachMode === "sheet";

  function download(href: string, name: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function save(slot: string) {
    if (!product.code) return;
    download(`/api/products/${product.code}/image/${slot}`, `${product.code}-${slot}.png`);
  }

  function saveSheet() {
    if (!product.code) return;
    if (sheet) {
      const url = URL.createObjectURL(sheet);
      download(url, `${product.code}-sheet.png`);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } else {
      download(`/api/products/${product.code}/sheet`, `${product.code}-sheet.png`);
    }
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
            {/*
              The primary button follows the choice on the left. The sheet is
              one image with BODY, PALLU, BORDER, BLOUSE printed above each
              panel — the only way a chat model can tell which photograph is
              which, since it is never shown filenames.
            */}
            {sheetMode ? (
              <>
                <button
                  type="button"
                  onClick={saveSheet}
                  className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-accent-hover"
                >
                  Download sheet
                </button>
                <button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={saving}
                  className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[14px] text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:opacity-50"
                >
                  {saving ? "Saving…" : `Files (${product.parts.length})`}
                </button>
                <span className="text-[12.5px] text-ink-faint">
                  {selections.modelSource === "photo"
                    ? "Attach the sheet first, then your photo, then paste the prompt."
                    : "One PNG, each photograph labelled in the pixels. Attach it with the prompt."}
                </span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={saving}
                  className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-accent-hover disabled:bg-surface-3 disabled:text-ink-soft"
                >
                  {saving ? "Saving…" : `Download all ${product.parts.length}`}
                </button>
                <button
                  type="button"
                  onClick={saveSheet}
                  className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[14px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
                >
                  Sheet
                </button>
                <span className="text-[12.5px] text-ink-faint">
                  {selections.modelSource === "photo"
                    ? "Originals, unresized. Attach body, pallu, border, blouse, then your photo last."
                    : "Originals, unresized. Attach them in the order body, pallu, border, blouse."}
                </span>
              </>
            )}
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
            {template.frozen && (
              <span
                title={`Approved ${template.frozen.on} on ${template.frozen.proof}. Wording does not change without a new version.`}
                className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-ink-soft"
              >
                Frozen · v{template.frozen.version}
              </span>
            )}
            <CopyButton text={prompt} className="ml-auto" />
          </div>
          <p className="mt-1.5 text-[13px] text-ink-faint">{template.summary}</p>
          <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-[1.75] text-ink-soft">{prompt}</p>

          {template.live && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <GeminiButton prompt={prompt} sheet={sheetMode ? sheet : null} />
              <span className="text-[12.5px] leading-relaxed text-ink-faint">
                {sheetMode
                  ? selections.modelSource === "photo"
                    ? "In Gemini: Ctrl+V pastes the sheet and the prompt. Attach your photo, then send."
                    : "In Gemini: Ctrl+V pastes the sheet and the prompt together. Then send."
                  : "In Gemini: attach the four files, Ctrl+V for the prompt, then send."}
              </span>
            </div>
          )}
        </article>

        <div className="mt-4">
          <Outputs
            code={product.code ?? ""}
            promptId={template.id}
            outputs={outputs[template.id] ?? []}
            onAdd={addOutput}
            onRemove={removeOutput}
          />
        </div>
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
