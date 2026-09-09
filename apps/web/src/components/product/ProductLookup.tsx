"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Start from the product code, not from a pile of files.
 *
 * The photographs Tantu needs already exist in SLK — taken once, on the floor,
 * against the consignment. Asking a merchant to find those same four files and
 * upload them again is the step that quietly does not get done, and the one
 * that makes a demo look easy and real use look like work.
 */

interface Part {
  slot: string | null;
  label: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

interface Product {
  code: string;
  title: string;
  description: string | null;
  design: {
    code: string;
    name: string;
    colour: string | null;
    productType: string | null;
    motif: string | null;
    motifCategory: string | null;
  };
  parts: Part[];
  /** Of the four the recipe needs, the ones this product has no photograph for. */
  missing: string[];
}

const NEEDED = ["body", "pallu", "border", "blouse"];

export function ProductLookup() {
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function look(event: React.FormEvent) {
    event.preventDefault();
    const wanted = code.trim();
    if (!wanted) return;

    setLoading(true);
    setError(null);
    setProduct(null);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(wanted)}`);
      const payload = (await response.json()) as Product & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Lookup failed (${response.status}).`);
      setProduct(payload);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <p className="label !text-madder">From the SLK catalogue</p>
        <h1 className="display mt-1 text-[28px]">Find a product</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          Type the code from the label. Its photographs come straight from SLK —
          nothing to download and upload again.
        </p>
      </header>

      <form onSubmit={look} className="mt-6 flex flex-wrap items-center gap-3">
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
          disabled={loading || code.trim() === ""}
          className="rounded-full bg-accent px-6 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
        >
          {loading ? "Looking…" : "Look up"}
        </button>
      </form>

      {error && (
        <p className="mt-5 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {product && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="display text-[22px]">{product.title}</h2>
            <span className="numeral text-[14px] text-ink-faint">{product.code}</span>
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-1 text-[13px]">
            <Fact k="Design">{product.design.code}</Fact>
            {product.design.colour && <Fact k="Colour">{product.design.colour}</Fact>}
            {product.design.productType && <Fact k="Type">{product.design.productType}</Fact>}
            {product.design.motif && <Fact k="Motif">{product.design.motif}</Fact>}
          </dl>

          {product.description ? (
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              {product.description}
            </p>
          ) : (
            /*
              Said plainly rather than left blank. An empty space reads as a
              loading failure; this reads as a job nobody has done yet, which
              is what it is.
            */
            <p className="mt-4 text-[14px] text-ink-faint">
              No description written for this product in SLK.
            </p>
          )}

          {product.missing.length > 0 && (
            <p className="mt-4 rounded-xl border border-madder/35 bg-madder/5 px-4 py-3 text-[14px] text-madder">
              Not photographed yet: {product.missing.join(", ")}. Generation needs all four.
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {NEEDED.map((slot) => {
              const part = product.parts.find((p) => p.slot === slot);
              return (
                <figure key={slot} className="m-0">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-surface">
                    {part ? (
                      <Image
                        src={part.url}
                        alt={part.alt}
                        fill
                        sizes="220px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-[12px] text-ink-faint">
                        not photographed
                      </span>
                    )}
                  </div>
                  <figcaption className="mt-1.5 text-[13px] capitalize text-ink-soft">
                    {slot}
                    {part?.width && (
                      <span className="block text-[11px] text-ink-faint">
                        {part.width} × {part.height}
                      </span>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {/* Anything SLK holds beyond the four the recipe uses. */}
          {product.parts.some((p) => !p.slot || !NEEDED.includes(p.slot)) && (
            <div className="mt-6">
              <p className="label mb-2">Also on file</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {product.parts
                  .filter((p) => !p.slot || !NEEDED.includes(p.slot))
                  .map((p) => (
                    <figure key={p.url} className="m-0">
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line">
                        <Image src={p.url} alt={p.alt} fill sizes="120px" className="object-cover" />
                      </div>
                      <figcaption className="mt-1 text-[11px] text-ink-faint">{p.label}</figcaption>
                    </figure>
                  ))}
              </div>
            </div>
          )}
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
