"use client";

import Image from "next/image";
import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import type { LoadedImage } from "@/lib/image";
import { REQUIRED_SLOTS, missingSlots, type ChosenProduct, type GarmentPart } from "./types";

/**
 * Which saree we are photographing.
 *
 * Two ways in, and the order matters. A code is one field and no work, because
 * the photographs already exist in SLK; uploading is four files and is what
 * anybody outside SLK's own stock has to do. Leading with the code makes the
 * easy path the obvious one without closing the other.
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
  missing: string[];
  error?: string;
}

const UPLOAD_SLOTS: { slot: string; label: string; hint: string; required: boolean }[] = [
  { slot: "body", label: "Body", hint: "A flat section of the main field, motif in focus.", required: true },
  { slot: "pallu", label: "Pallu", hint: "Fill the frame with the decorated end.", required: true },
  { slot: "border", label: "Border", hint: "A straight run of border, edge parallel to the frame.", required: true },
  { slot: "blouse", label: "Blouse", hint: "The blouse piece flat and whole.", required: true },
];

export function StepProduct({
  product,
  onChange,
}: {
  product: ChosenProduct | null;
  onChange: (product: ChosenProduct | null) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
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
        : {
            code: null,
            title: "Uploaded saree",
            description: null,
            design: null,
            parts,
          },
    );
  }

  const gaps = missingSlots(product);

  return (
    <div className="space-y-8">
      <div className="flex gap-2">
        {(["code", "upload"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`rounded-full border px-4 py-2 text-[14px] transition ${
              mode === option
                ? "border-accent bg-accent-wash text-accent"
                : "border-line text-ink-soft hover:border-ink-faint"
            }`}
          >
            {option === "code" ? "From a product code" : "Upload photographs"}
          </button>
        ))}
      </div>

      {mode === "code" ? (
        <form onSubmit={lookUp} className="flex flex-wrap items-center gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="300021"
            aria-label="Product code"
            className="numeral w-44 rounded-full border border-line bg-surface px-5 py-3 text-[16px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || code.trim() === ""}
            className="rounded-full bg-accent px-6 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
          >
            {busy ? "Looking…" : "Look up"}
          </button>
          <span className="text-[13px] text-ink-faint">
            The code on the label. Photographs come from SLK.
          </span>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {UPLOAD_SLOTS.map((s) => (
            <Dropzone
              key={s.slot}
              label={s.label}
              hint={s.hint}
              required={s.required}
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
        <p className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {product && (
        <section>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="display text-[22px]">{product.title}</h2>
            {product.code && (
              <span className="numeral text-[14px] text-ink-faint">{product.code}</span>
            )}
          </div>

          {product.design && (
            <dl className="mt-2 flex flex-wrap gap-x-7 gap-y-1 text-[13px]">
              <Fact k="Design">{product.design.code}</Fact>
              {product.design.colour && <Fact k="Colour">{product.design.colour}</Fact>}
              {product.design.motif && <Fact k="Motif">{product.design.motif}</Fact>}
            </dl>
          )}

          {product.description ? (
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              {product.description}
            </p>
          ) : product.code ? (
            <p className="mt-3 text-[13px] text-ink-faint">
              No description written for this product in SLK.
            </p>
          ) : null}

          {gaps.length > 0 && (
            <p className="mt-4 rounded-xl border border-madder/35 bg-madder/5 px-4 py-3 text-[14px] text-madder">
              Missing {gaps.join(", ")}. All four parts are needed to generate.
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {REQUIRED_SLOTS.map((slot) => {
              const part = product.parts.find((p) => p.slot === slot);
              return (
                <figure key={slot} className="m-0">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-surface">
                    {part ? (
                      <Image src={part.src} alt={part.alt} fill sizes="220px" className="object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-[12px] text-ink-faint">
                        missing
                      </span>
                    )}
                  </div>
                  <figcaption className="mt-1.5 text-[13px] capitalize text-ink-soft">{slot}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="m-0 text-ink">{children}</dd>
    </div>
  );
}
