import Link from "next/link";
import { generationRecords } from "@/lib/generationRecords";
import { requirePage } from "@/lib/page-auth";
import { rupees } from "@/lib/spend";

export const dynamic = "force-dynamic";

/**
 * What went in and what came out, image by image: the sheet sent with the
 * prompt, the exact prompt, and the result. For judging a prompt version on
 * real runs rather than on a reconstruction of them.
 */
export default async function GenerationsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  await requirePage("/admin/generations", { platform: true });
  const { product } = await searchParams;
  const code = product?.trim() || undefined;
  const records = await generationRecords({ productCode: code, limit: 30 });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="label">
        <Link href="/admin/spend" className="hover:text-ink">
          Platform
        </Link>
      </p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">Generations</h1>
      <p className="mt-1 text-[13px] text-ink-soft">The input sheet, the exact prompt and the image for each run, newest first.</p>

      <form className="mt-4 flex gap-2" action="/admin/generations">
        <input
          name="product"
          defaultValue={code ?? ""}
          placeholder="Product ID, e.g. UNCLE"
          className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
        />
        <button type="submit" className="rounded-lg border border-line px-4 py-2 text-[14px] hover:border-ink-faint">
          Show
        </button>
        {code && (
          <Link href="/admin/generations" className="self-center text-[13px] text-ink-soft underline">
            All products
          </Link>
        )}
      </form>

      {records.length === 0 && <p className="mt-6 text-[14px] text-ink-soft">No generations{code ? ` for ${code}` : ""} yet.</p>}

      <div className="mt-6 grid gap-5">
        {records.map((r) => (
          <article key={r.id} className="rounded-xl border border-line bg-surface p-5">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[15px] font-semibold">
                {r.productCode ?? r.title} · {r.promptId}
              </h2>
              <span className="text-[13px] text-ink-soft">
                {new Date(r.startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span className="text-[13px] text-ink-soft">
                prompt <b className="text-ink">{r.promptVersion}</b> · {r.model}
              </span>
              <span className={`text-[13px] ${r.status === "done" ? "text-good" : "text-danger"}`}>{r.status}</span>
              <span className="text-[13px] tabular-nums text-ink-faint">
                {rupees(r.costPaise)}
                {r.ms ? ` · ${(r.ms / 1000).toFixed(0)} s` : ""}
              </span>
            </header>
            {r.error && <p className="mt-2 text-[13px] text-danger">{r.error.length > 240 ? `${r.error.slice(0, 240)}…` : r.error}</p>}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <figure>
                <figcaption className="text-[12px] uppercase tracking-wide text-ink-faint">
                  Input sheet{r.sheetRecorded ? "" : " (the product's current sheet; this run is older than sheet records)"}
                </figcaption>
                {r.sheetUrl ? (
                  <a href={r.sheetUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.sheetUrl} alt="Input sheet" className="mt-2 max-h-80 w-full rounded-lg border border-line-soft object-contain" />
                  </a>
                ) : (
                  <p className="mt-2 text-[13px] text-ink-faint">No sheet stored.</p>
                )}
              </figure>
              <figure>
                <figcaption className="text-[12px] uppercase tracking-wide text-ink-faint">Result</figcaption>
                {r.imageUrl ? (
                  <a href={r.imageUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.imageUrl} alt="Generated image" className="mt-2 max-h-80 w-full rounded-lg border border-line-soft object-contain" />
                  </a>
                ) : (
                  <p className="mt-2 text-[13px] text-ink-faint">No image.</p>
                )}
              </figure>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-[13.5px] font-medium">
                Prompt sent ({r.promptText.length.toLocaleString("en-IN")} characters)
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-line-soft bg-ground p-3 text-[12.5px] leading-relaxed">
                {r.promptText}
              </pre>
            </details>
            <p className="mt-3 flex flex-wrap gap-4 text-[13px]">
              <a className="underline" href={`/api/platform/generations?format=text&id=${r.id}`}>
                Download prompt
              </a>
              {r.sheetUrl && (
                <a className="underline" href={r.sheetUrl} target="_blank" rel="noreferrer">
                  Open input sheet
                </a>
              )}
              {r.imageUrl && (
                <a className="underline" href={r.imageUrl} target="_blank" rel="noreferrer">
                  Open image
                </a>
              )}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
