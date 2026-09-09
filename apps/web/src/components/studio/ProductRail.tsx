"use client";

import Image from "next/image";
import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import type { LoadedImage } from "@/lib/image";
import { CopyButton } from "./CopyButton";
import { REQUIRED_SLOTS, missingSlots, type ChosenProduct, type GarmentPart } from "./types";

/**
 * Everything you set, in one column.
 *
 * The controls used to run down the middle of the page with the output below
 * them, which meant scrolling away from the saree to read the prompt written
 * for it. Side by side, the thing you are working on stays in view while you
 * work.
 */

interface ApiPart {
  slot: string | null;
  label: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

interface ApiProduct {
  code: string;
  title: string;
  description: string | null;
  design: ChosenProduct["design"];
  parts: ApiPart[];
  error?: string;
}

const UPLOAD_SLOTS = [
  { slot: "body", label: "Body" },
  { slot: "pallu", label: "Pallu" },
  { slot: "border", label: "Border" },
  { slot: "blouse", label: "Blouse" },
];

export function ProductRail({
  product,
  onChange,
}: {
  product: ChosenProduct | null;
  onChange: (product: ChosenProduct | null) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"code" | "upload">("code");
  const [uploads, setUploads] = useState<Record<string, LoadedImage>>({});

  async function lookUp(event: React.FormEvent) {
    event.preventDefault();
    const wanted = code.trim();
    if (!wanted) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(wanted)}`);
      const payload = (await response.json()) as ApiProduct;
      if (!response.ok) throw new Error(payload.error ?? `Lookup failed (${response.status}).`);
      onChange({
        code: payload.code,
        title: payload.title,
        description: payload.description,
        design: payload.design,
        parts: payload.parts
          .filter((p): p is ApiPart & { slot: string } => p.slot !== null)
          .map<GarmentPart>((p) => ({
            slot: p.slot,
            label: p.label,
            src: p.url,
            width: p.width,
            height: p.height,
            alt: p.alt,
          })),
      });
    } catch (problem) {
      onChange(null);
      setError(problem instanceof Error ? problem.message : "The lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  function applyUploads(next: Record<string, LoadedImage>) {
    setUploads(next);
    const parts = Object.entries(next).map<GarmentPart>(([slot, image]) => ({
      slot,
      label: slot,
      src: image.dataUrl,
      width: image.width,
      height: image.height,
      alt: slot,
    }));
    onChange(
      parts.length === 0
        ? null
        : { code: null, title: "Uploaded saree", description: null, design: null, parts },
    );
  }

  function save(slot: string) {
    if (!product?.code) return;
    const a = document.createElement("a");
    a.href = `/api/products/${product.code}/image/${slot}`;
    a.download = `${product.code}-${slot}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function saveAll() {
    if (!product) return;
    setSaving(true);
    for (const part of product.parts) {
      save(part.slot);
      // One at a time: a burst of saves from a single gesture gets blocked.
      await new Promise((r) => setTimeout(r, 700));
    }
    setSaving(false);
  }

  const gaps = missingSlots(product);
  const links = product?.parts.map((p) => `${p.slot}: ${p.src}`).join("\n") ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Saree
        </h2>

        <div className="mt-3 flex gap-1.5">
          {(["code", "upload"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                mode === option
                  ? "border-accent bg-accent-wash text-accent"
                  : "border-line text-ink-soft hover:border-ink-faint"
              }`}
            >
              {option === "code" ? "Product code" : "Upload"}
            </button>
          ))}
        </div>

        {mode === "code" ? (
          <form onSubmit={lookUp} className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="300021"
              aria-label="Product code"
              className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-[15px] tabular-nums outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || code.trim() === ""}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
            >
              {busy ? "…" : "Find"}
            </button>
          </form>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {UPLOAD_SLOTS.map((s) => (
              <Dropzone
                key={s.slot}
                label={s.label}
                compact
                required
                value={uploads[s.slot]}
                onPick={(image) => applyUploads({ ...uploads, [s.slot]: image })}
                onClear={() => {
                  const next = { ...uploads };
                  delete next[s.slot];
                  applyUploads(next);
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>

      {product && (
        <>
          <div className="border-t border-line-soft pt-5">
            <p className="text-[15px] font-medium leading-snug text-ink">{product.title}</p>
            {product.code && (
              <p className="mt-0.5 text-[13px] tabular-nums text-ink-faint">{product.code}</p>
            )}
            {product.design && (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                {[product.design.colour, product.design.motif, product.design.productType]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {product.description ? (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{product.description}</p>
            ) : product.code ? (
              <p className="mt-2 text-[12px] text-ink-faint">No description written in SLK.</p>
            ) : null}
          </div>

          <div className="border-t border-line-soft pt-5">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                Photographs
              </h2>
              {product.code && <CopyButton text={links} label="Links" className="ml-auto" />}
            </div>

            {gaps.length > 0 && (
              <p className="mt-2 text-[12px] text-madder">Missing {gaps.join(", ")}.</p>
            )}

            <ul className="mt-3 space-y-2">
              {REQUIRED_SLOTS.map((slot) => {
                const part = product.parts.find((p) => p.slot === slot);
                if (!part) return null;
                return (
                  <li key={slot} className="flex items-center gap-2.5">
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-line">
                      <Image src={part.src} alt={part.alt} fill sizes="40px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] capitalize text-ink-soft">
                      {slot}
                    </span>
                    {product.code && (
                      <button
                        type="button"
                        onClick={() => save(slot)}
                        className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
                      >
                        Save
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {product.code && (
              <button
                type="button"
                onClick={() => void saveAll()}
                disabled={saving}
                className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-white transition hover:bg-accent-hover disabled:bg-surface-3 disabled:text-ink-soft"
              >
                {saving ? "Saving…" : `Download all ${product.parts.length}`}
              </button>
            )}
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              Gemini cannot open a link — save the files and attach them.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
