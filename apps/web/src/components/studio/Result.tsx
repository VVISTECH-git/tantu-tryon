"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  garmentWordsFrom,
  missingWords,
  type DescribedGarment,
  type GarmentWords,
} from "@/content/garmentWords";
import {
  TEMPLATES,
  composePrompt,
  type Selections,
} from "@/content/promptTemplates";
import { rotationQuery, turn, type Rotations } from "@/lib/rotation";
import {
  addRun,
  deleteRun,
  listRuns,
  runId,
  updateRun,
  type Run,
  type Verdict,
} from "@/lib/runs";
import { CopyButton } from "./CopyButton";
import { GarmentWordsPanel } from "./GarmentWordsPanel";
import { GeminiButton } from "./GeminiButton";
import { Lightbox } from "./Lightbox";
import { ReviewBoard } from "./ReviewBoard";
import {
  REQUIRED_SLOTS,
  missingSlots,
  type ChosenProduct,
  type StudioStatus,
} from "./types";

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
  canDescribe,
  onStatus,
}: {
  product: ChosenProduct;
  selections: Selections;
  /** Whether this deployment has an engine key to read the photographs with. */
  canDescribe: boolean;
  /** Where the product stands, for the rail. */
  onStatus: (status: StudioStatus) => void;
}) {
  const [active, setActive] = useState(
    TEMPLATES.find((t) => t.live)?.id ?? "P1",
  );
  const [saving, setSaving] = useState(false);
  const [moreFacts, setMoreFacts] = useState(false);

  /*
    The saree in words — described from the sheet or typed — remembered for
    this product in this browser. SLK's record fills whatever is not here.
  */
  const wordsKey = `tantu:garment:${product.code ?? "upload"}`;
  const [savedWords, setSavedWords] = useState<DescribedGarment>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(wordsKey) ?? "{}",
      ) as DescribedGarment;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      if (Object.keys(savedWords).length > 0)
        localStorage.setItem(wordsKey, JSON.stringify(savedWords));
      else localStorage.removeItem(wordsKey);
    } catch {
      // Storage refused — the words still apply for this visit.
    }
  }, [savedWords, wordsKey]);

  /*
    The sheet, fetched once per product and held as a blob. The Gemini button
    needs it in hand — a clipboard write has to happen inside the click — and
    Download sheet can then serve it without a second build on the server.
  */
  /*
    Orientation corrections, per part, remembered for this product in this
    browser. Result only mounts after a product is found, client-side, so
    reading storage in the initialiser cannot disagree with a server render.
  */
  const storageKey = `tantu:rotation:${product.code ?? "upload"}`;
  const [rotations, setRotations] = useState<Rotations>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Rotations;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      if (Object.values(rotations).some((d) => d !== 0))
        localStorage.setItem(storageKey, JSON.stringify(rotations));
      else localStorage.removeItem(storageKey);
    } catch {
      // Storage refused — the turn still applies for this visit.
    }
  }, [rotations, storageKey]);
  const rotQuery = rotationQuery(rotations);

  function rotate(slot: string) {
    setRotations((prev) => ({ ...prev, [slot]: turn(prev[slot] ?? 0) }));
  }

  const [viewing, setViewing] = useState<number | null>(null);
  const present = REQUIRED_SLOTS.map((slot) =>
    product.parts.find((p) => p.slot === slot),
  ).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const sheetKey = `${product.code}${rotQuery}`;
  const [fetched, setFetched] = useState<{ key: string; blob: Blob } | null>(
    null,
  );
  const sheet = fetched && fetched.key === sheetKey ? fetched.blob : null;
  useEffect(() => {
    const code = product.code;
    if (!code) return;
    const key = `${code}${rotQuery}`;
    const controller = new AbortController();
    fetch(`/api/products/${code}/sheet${rotQuery}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !controller.signal.aborted) setFetched({ key, blob });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [product.code, rotQuery]);

  /*
    The runs for this product, from the browser's own store. Loaded once per
    product; every change is written through and mirrored here, so the board
    never waits on a read.
  */
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    const code = product.code;
    if (!code) return;
    let alive = true;
    listRuns(code)
      .then((list) => {
        if (alive) setRuns(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [product.code]);

  const d = product.design;
  const garment = garmentWordsFrom(d, savedWords);

  /*
    The files the prompt will be pasted alongside, named exactly as the
    download names them. Listed in the order a person reads a saree — body,
    pallu, border, blouse — not the order SLK happened to return them.
  */
  const files = product.code
    ? REQUIRED_SLOTS.filter((slot) =>
        product.parts.some((p) => p.slot === slot),
      ).map((slot) => ({
        slot,
        file: `${product.code}-${slot}.png`,
      }))
    : [];

  const template = TEMPLATES.find((t) => t.id === active) ?? TEMPLATES[0]!;
  const prompt = template.live
    ? composePrompt(template, garment, selections, files)
    : "";
  const gaps = missingSlots(product);
  const sheetMode = selections.attachMode === "sheet";
  const [showPrompt, setShowPrompt] = useState(false);

  const version = template.frozen ? `v${template.frozen.version}` : "draft";
  const chosen = [
    selections.modelSource === "photo"
      ? `${selections.modelType} from photo`
      : `${selections.modelType} · ${selections.age}`,
    selections.background,
    sheetMode ? "sheet" : "files",
  ].join(" · ");

  function addOutput(file: File) {
    if (!product.code) return;
    const run: Run = {
      id: runId(),
      code: product.code,
      promptId: active,
      version,
      prompt,
      selections: chosen,
      image: file,
      at: new Date().toISOString(),
      verdict: null,
      note: "",
    };
    setRuns((prev) => [...prev, run]);
    void addRun(run).catch(() => {});
  }

  function setVerdict(id: string, verdict: Verdict) {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, verdict } : r)));
    void updateRun(id, { verdict }).catch(() => {});
  }

  function setNote(id: string, note: string) {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, note } : r)));
    void updateRun(id, { note }).catch(() => {});
  }

  function removeRun(id: string) {
    setRuns((prev) => prev.filter((r) => r.id !== id));
    void deleteRun(id).catch(() => {});
  }

  const tally = (id: string) => {
    const mine = runs.filter((r) => r.promptId === id);
    return {
      approved: mine.filter((r) => r.verdict === "approved").length,
      rejected: mine.filter((r) => r.verdict === "rejected").length,
      total: mine.length,
    };
  };

  // The rail's summary, recomputed whenever what it summarises changes.
  const wordsMissing = missingWords(garment);
  const statusKey = JSON.stringify([
    product.parts.length,
    wordsMissing,
    TEMPLATES.filter((t) => t.live).map((t) => [t.id, tally(t.id)]),
  ]);
  useEffect(() => {
    onStatus({
      photos: {
        have: REQUIRED_SLOTS.filter((s) =>
          product.parts.some((p) => p.slot === s),
        ).length,
        need: REQUIRED_SLOTS.length,
      },
      wordsMissing,
      prompts: TEMPLATES.filter((t) => t.live).map((t) => ({
        id: t.id,
        title: t.title,
        frozen: t.frozen ? `v${t.frozen.version}` : null,
        ...tally(t.id),
      })),
    });
    // statusKey captures every input above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, onStatus]);

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
    const deg = rotations[slot] ?? 0;
    download(
      `/api/products/${product.code}/image/${slot}${rotationQuery({ [slot]: deg })}`,
      `${product.code}-${slot}.png`,
    );
  }

  function saveSheet() {
    if (!product.code) return;
    if (sheet) {
      const url = URL.createObjectURL(sheet);
      download(url, `${product.code}-sheet.png`);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } else {
      download(
        `/api/products/${product.code}/sheet${rotQuery}`,
        `${product.code}-sheet.png`,
      );
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
      {viewing !== null && product.code && present[viewing] && (
        <Lightbox
          code={product.code}
          parts={present}
          index={viewing}
          rotations={rotations}
          onIndex={setViewing}
          onRotate={rotate}
          onClose={() => setViewing(null)}
        />
      )}

      <section>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            {product.title}
          </h1>
          {product.code && (
            <span className="text-[14px] tabular-nums text-ink-faint">
              {product.code}
            </span>
          )}
        </div>

        {/*
          The facts that matter to a prompt, on one line; the rest behind
          More. Ten label-and-value pairs in a grid were a block of height
          between the title and the photographs, for four values anyone
          looked at.
        */}
        {d && (
          <p className="mt-1.5 text-[13.5px] text-ink-soft">
            {[
              d.fibreType,
              [d.craftTechnique, d.craftSubType].filter(Boolean).join(", "),
              d.borderHeight && `border ${d.borderHeight}`,
              d.blouseStyle && `${d.blouseStyle.toLowerCase()} blouse`,
              d.audienceType && `for ${d.audienceType.toLowerCase()}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            <button
              type="button"
              onClick={() => setMoreFacts((m) => !m)}
              aria-expanded={moreFacts}
              className="ml-2 text-[13px] text-accent hover:underline"
            >
              {moreFacts ? "Less" : "More"}
            </button>
          </p>
        )}
        {d && moreFacts && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13.5px] sm:grid-cols-[auto_1fr_auto_1fr] xl:grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
            <Fact k="Design">{d.code}</Fact>
            <Fact k="Colour">{d.colour}</Fact>
            <Fact k="Motif">{d.motif}</Fact>
            <Fact k="Weave">{d.weaveStructure}</Fact>
            <Fact k="Pallu">{d.palluMotif}</Fact>
            <Fact k="Border">
              {[d.borderMotif, d.borderHeight].filter(Boolean).join(" · ") ||
                null}
            </Fact>
            <Fact k="Blouse">
              {[d.blouseStyle, d.blouseMotif].filter(Boolean).join(" · ") ||
                null}
            </Fact>
            <Fact k="Description">{product.description}</Fact>
          </dl>
        )}
      </section>

      <section>
        {gaps.length > 0 && (
          <p className="mb-3 rounded-xl border border-madder/35 bg-madder/5 px-4 py-2.5 text-[13.5px] text-madder">
            Not photographed yet: {gaps.join(", ")}.
          </p>
        )}
        {/*
          Four across the full width, each with its words underneath: what
          the prompt will say this part looks like. A print should be readable
          from the tile, and the caption is where a wrong colour is noticed.
        */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {REQUIRED_SLOTS.map((slot) => {
            const part = product.parts.find((p) => p.slot === slot);
            const words = captionFor(slot, garment);
            return (
              <figure key={slot} className="m-0 min-w-0">
                {part ? (
                  <button
                    type="button"
                    onClick={() => setViewing(present.indexOf(part))}
                    title="Open large"
                    className="relative block aspect-[4/5] w-full overflow-hidden rounded-xl border border-line bg-surface transition hover:border-ink-faint focus:outline-none focus-visible:border-accent"
                  >
                    <Image
                      src={part.src}
                      alt={part.alt}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover"
                      style={{
                        transform: `rotate(${rotations[slot] ?? 0}deg)`,
                      }}
                    />
                  </button>
                ) : (
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-dashed border-line bg-surface">
                    <span className="grid h-full place-items-center text-[13px] text-ink-faint">
                      Not photographed
                    </span>
                  </div>
                )}
                <figcaption className="mt-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-[14px] font-medium capitalize text-ink">
                    {slot}
                    {(rotations[slot] ?? 0) !== 0 && (
                      <span className="text-[11.5px] font-normal normal-case text-ink-faint">
                        turned {rotations[slot]}°
                      </span>
                    )}
                    {part && product.code && (
                      <button
                        type="button"
                        onClick={() => save(slot)}
                        className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-[12px] font-normal normal-case text-ink-soft transition hover:border-ink-faint hover:text-ink"
                      >
                        Save
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-baseline gap-1.5 text-[12.5px] leading-snug text-ink-soft">
                    {words.colour ? (
                      <span className="shrink-0 font-medium text-ink">
                        {words.colour}
                      </span>
                    ) : (
                      <span className="shrink-0 text-turmeric">colour?</span>
                    )}
                    <span className="line-clamp-2 min-w-0">{words.desc}</span>
                  </p>
                </figcaption>
              </figure>
            );
          })}
        </div>

        {product.code && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
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

            <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />

            <GarmentWordsPanel
              code={product.code}
              rotQuery={rotQuery}
              words={garment}
              saved={savedWords}
              onChange={setSavedWords}
              canDescribe={canDescribe}
            />
          </div>
        )}
      </section>

      <ReviewBoard
        code={product.code ?? ""}
        promptId={template.id}
        runs={runs.filter((r) => r.promptId === template.id)}
        onAdd={addOutput}
        onVerdict={setVerdict}
        onNote={setNote}
        onRemove={removeRun}
        prompt={
          <>
            {/*
          Prompt buttons carry their record: how many runs approved and
          rejected. Which prompt is trustworthy is read off the row.
        */}
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => {
                const n = tally(t.id);
                const on = active === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!t.live}
                    onClick={() => {
                      setActive(t.id);
                      setShowPrompt(false);
                    }}
                    aria-pressed={on}
                    title={t.live ? t.title : "Not written yet"}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-[14px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      on
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink"
                    }`}
                  >
                    Prompt {t.id.slice(1)}
                    {n.total > 0 && (
                      <span
                        className={`text-[12px] tabular-nums ${on ? "text-white/80" : "text-ink-faint"}`}
                      >
                        {n.approved > 0 && `✓${n.approved}`}
                        {n.approved > 0 && n.rejected > 0 && " "}
                        {n.rejected > 0 && `✗${n.rejected}`}
                        {n.approved === 0 && n.rejected === 0 && `${n.total}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/*
          The prompt as a card, not a document. Its name, its status, and the
          one thing to do with it. The text itself is behind a toggle: it is
          copied, never read, and two thousand words of it were burying the
          photographs and the runs.
        */}
            <article className="mt-4 rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-full bg-accent-wash px-2 py-0.5 text-[12px] font-semibold tabular-nums text-accent">
                  {template.id}
                </span>
                <h2 className="text-[16px] font-semibold text-ink">
                  {template.title}
                </h2>
                {template.frozen ? (
                  <span
                    title={`Approved ${template.frozen.on} on ${template.frozen.proof}. Wording does not change without a new version.`}
                    className="rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-good"
                  >
                    Frozen · v{template.frozen.version}
                  </span>
                ) : (
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-ink-faint">
                    Draft
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13.5px] text-ink-soft">
                {template.summary}
              </p>
              <p className="mt-1 text-[12.5px] text-ink-faint">{chosen}</p>

              {template.live && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <GeminiButton
                    prompt={prompt}
                    sheet={sheetMode ? sheet : null}
                  />
                  <CopyButton text={prompt} />
                  <button
                    type="button"
                    onClick={() => setShowPrompt((s) => !s)}
                    aria-expanded={showPrompt}
                    className="rounded-full border border-line px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
                  >
                    {showPrompt ? "Hide text" : "Show text"}
                  </button>
                  <span className="basis-full text-[12.5px] leading-relaxed text-ink-faint sm:basis-auto">
                    {sheetMode
                      ? selections.modelSource === "photo"
                        ? "In Gemini: Ctrl+V, attach your photo, send."
                        : "In Gemini: Ctrl+V, then send."
                      : "In Gemini: attach the four files, Ctrl+V, send."}
                  </span>
                </div>
              )}

              {showPrompt && (
                <p className="mt-4 max-h-[60vh] overflow-y-auto whitespace-pre-wrap border-t border-line pt-4 text-[13px] leading-[1.7] text-ink-soft">
                  {prompt}
                </p>
              )}
            </article>
          </>
        }
      />
    </div>
  );
}

/** The caption under a photograph: its ground colour and one line of what is on it. */
function captionFor(
  slot: string,
  w: GarmentWords,
): { colour: string | null; desc: string } {
  switch (slot) {
    case "body":
      return { colour: w.bodyColour, desc: w.bodyDesc };
    case "pallu":
      return { colour: w.palluColour, desc: w.palluDesc };
    case "border":
      return {
        colour: w.borderColour,
        desc: [w.borderDesc, w.borderWidth].filter(Boolean).join(", "),
      };
    case "blouse":
      return { colour: w.blouseColour, desc: w.blouseDesc };
    default:
      return { colour: null, desc: "" };
  }
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "")
    return null;
  return (
    <>
      <dt className="text-ink-faint">{k}</dt>
      <dd className="m-0 text-ink">{children}</dd>
    </>
  );
}
