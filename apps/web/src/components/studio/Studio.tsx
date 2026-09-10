"use client";

import { useState } from "react";
import {
  defaultAge,
  defaultRules,
  modelTypeFor,
  type Selections,
} from "@/content/promptTemplates";
import { Rail } from "./Rail";
import { Result } from "./Result";
import type { ChosenProduct, GarmentPart, StudioStatus } from "./types";

/**
 * One page: what you set on the left, what you take on the right.
 *
 * Tantu does not generate here and spends nothing. It finds the saree, gives
 * you its photographs as files, and composes the prompts from what SLK knows
 * about the product and what you chose — the generation happens wherever you
 * paste the result.
 *
 * Headings are set in the body face, not the display serif. Prata is a
 * high-contrast Didone: right at 40px on a marketing page, and at 15px its
 * thin strokes drop out and it reads like a page printed with a failing
 * cartridge. A working screen is read all day.
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

export function Studio({ canDescribe = false }: { canDescribe?: boolean }) {
  const [product, setProduct] = useState<ChosenProduct | null>(null);
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Selections>({
    modelType: "woman",
    modelSource: "generated",
    age: defaultAge("woman"),
    background: "courtyard",
    attachMode: "sheet",
    rules: defaultRules(),
  });

  async function find(code: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(code)}`);
      const payload = (await response.json()) as ApiProduct;
      if (!response.ok) throw new Error(payload.error ?? `Lookup failed (${response.status}).`);

      setProduct({
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

      // The product knows who it is for. Start there; the person can change it.
      const modelType = modelTypeFor(payload.design?.audienceType);
      setSelections((s) => ({ ...s, modelType, age: defaultAge(modelType) }));
    } catch (problem) {
      setProduct(null);
      setStatus(null);
      setError(problem instanceof Error ? problem.message : "The lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  /*
    The whole width. A working screen with photographs on it has no reason
    to sit in a band down the middle of a wide monitor: the rail keeps its
    size and the results take everything else.
  */
  return (
    <div className="grid gap-10 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8 2xl:px-12">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <Rail
          onFind={find}
          busy={busy}
          error={error}
          selections={selections}
          onChange={setSelections}
          hasProduct={product !== null}
          status={status}
        />
      </aside>

      <main className="min-w-0">
        {product ? (
          <Result product={product} selections={selections} canDescribe={canDescribe} onStatus={setStatus} />
        ) : (
          <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-[15px] text-ink-soft">Enter a product code to begin.</p>
            <p className="mt-1 text-[13px] text-ink-faint">
              The product, its photographs and the prompts will appear here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
