import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { productInputsById, productRows } from "@/lib/productInputs";
import { DeleteProduct } from "./DeleteProduct";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/**
 * Every product the phones have captured, newest first, with its photos,
 * who took them and when (28 Sep: to see what the photographer login has
 * done). One product opens its inputs: the photos, the input sheet and the
 * prompt each pose would send. Nothing here generates or costs anything.
 */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ by?: string; open?: string }> }) {
  await requirePage("/admin/products", { platform: true });
  const { by, open } = await searchParams;

  if (open) {
    const [g, list] = await Promise.all([productInputsById(open), productRows()]);
    // Previous / Next walk the list in its own order (newest first), keeping its filter.
    const order = by ? list.filter((r) => r.takenBy.includes(by)) : list;
    const at = order.findIndex((r) => r.id === open);
    const prev = at > 0 ? order[at - 1] : null;
    const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
    const keep = by ? `&by=${encodeURIComponent(by)}` : "";
    const nav = (
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13.5px]">
        <Link href={`/admin/products${by ? `?by=${encodeURIComponent(by)}` : ""}`} className="text-accent underline">
          ‹ All products
        </Link>
        <span className="flex items-center gap-4">
          {prev ? (
            <Link href={`/admin/products?open=${prev.id}${keep}`} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">
              ‹ Previous · {prev.productCode ?? "No product ID"}
            </Link>
          ) : (
            <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">‹ Previous</span>
          )}
          {at >= 0 && <span className="text-ink-faint tabular-nums">{at + 1} of {order.length}</span>}
          {next ? (
            <Link href={`/admin/products?open=${next.id}${keep}`} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">
              Next · {next.productCode ?? "No product ID"} ›
            </Link>
          ) : (
            <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">Next ›</span>
          )}
        </span>
      </div>
    );
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        {nav}
        {!g ? (
          <p className="mt-4 text-[14px] text-ink-soft">No such product.</p>
        ) : (
          <>
            <h1 className="mt-5 text-[24px] font-semibold tracking-tight">{g.productCode ?? "No product ID"}</h1>
            <p className="mt-1 text-[13px] text-ink-soft">What this product feeds the image model, whether or not anything has been generated yet.</p>

            <p className="mt-6 text-[12px] uppercase tracking-wide text-ink-faint">Photos taken ({g.parts.length})</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              {g.parts.map((p) => (
                <figure key={p.slot}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.previewUrl ?? p.url} alt={p.slot} className="max-h-72 w-full rounded-lg border border-line-soft bg-surface object-contain" />
                  </a>
                  <figcaption className="mt-1 text-[12.5px] text-ink-soft">
                    <b className="text-ink">{p.slot}</b>
                    {p.width && p.height ? ` · ${p.width} × ${p.height}` : ""}
                    {p.quality ? ` · ${p.quality}` : ""}
                    {p.takenBy ? ` · ${p.takenBy}` : ""}
                    {p.takenAt ? ` · ${when(p.takenAt)}` : ""}
                    {" · "}
                    <a href={p.url} target="_blank" rel="noreferrer" className="underline">
                      original
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-6 text-[12px] uppercase tracking-wide text-ink-faint">Input sheet (what the image model gets)</p>
            {g.sheetUrl ? (
              <a href={g.sheetUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.sheetUrl} alt="Input sheet" className="mt-2 max-h-96 rounded-lg border border-line-soft object-contain" />
              </a>
            ) : (
              <p className="mt-2 text-[13px] text-ink-faint">Not made yet: it is built the first time Continue is tapped on the phone.</p>
            )}

            {g.prompts.length > 0 && (
              <>
                <p className="mt-6 text-[12px] uppercase tracking-wide text-ink-faint">Prompt each pose would send (the phone&apos;s look: woman, late 20s, courtyard)</p>
                <div className="mt-2 grid gap-2">
                  {g.prompts.map((pr) => (
                    <details key={pr.promptId} className="rounded-lg border border-line-soft bg-surface p-3">
                      <summary className="cursor-pointer text-[13.5px]">
                        <b>{pr.promptId}</b> · {pr.title} · <span className="text-ink-soft">{pr.version}</span> · {pr.text.length.toLocaleString("en-IN")} characters
                      </summary>
                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-ground p-3 text-[12.5px] leading-relaxed">{pr.text}</pre>
                    </details>
                  ))}
                </div>
              </>
            )}
            {g.productCode && (
              <p className="mt-6 text-[13.5px]">
                <Link href={`/admin/generations?product=${encodeURIComponent(g.productCode)}`} className="text-accent underline">
                  Images generated for {g.productCode} →
                </Link>
              </p>
            )}
            <DeleteProduct id={g.id} name={g.productCode ?? "this product"} />
          </>
        )}
        <div className="mt-8">{nav}</div>
      </div>
    );
  }

  const all = await productRows();
  const people = [...new Set(all.flatMap((r) => r.takenBy))].sort();
  const rows = by ? all.filter((r) => r.takenBy.includes(by)) : all;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="label">
        <Link href="/admin/spend" className="hover:text-ink">
          Platform
        </Link>
      </p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">Products</h1>
      <p className="mt-1 text-[13px] text-ink-soft">Every product captured on the phones, newest first. Open one to see its photos, input sheet and prompts.</p>

      <p className="mt-4 flex flex-wrap gap-2 text-[13px]">
        <Link href="/admin/products" className={`rounded-full border px-3 py-1 ${!by ? "border-accent text-accent" : "border-line"}`}>
          Everyone ({all.length})
        </Link>
        {people.map((p) => (
          <Link
            key={p}
            href={`/admin/products?by=${encodeURIComponent(p)}`}
            className={`rounded-full border px-3 py-1 ${by === p ? "border-accent text-accent" : "border-line"}`}
          >
            {p} ({all.filter((r) => r.takenBy.includes(p)).length})
          </Link>
        ))}
      </p>

      <div className="mt-5 grid gap-3">
        {rows.map((r) => (
          <Link key={r.id} href={`/admin/products?open=${r.id}${by ? `&by=${encodeURIComponent(by)}` : ""}`} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3 hover:border-ink-faint">
            <div className="flex gap-1.5">
              {r.photos.slice(0, 4).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.slot} src={p.thumbUrl} alt={p.slot} title={p.slot} className="h-16 w-12 rounded border border-line-soft object-cover" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold">{r.productCode ?? "No product ID"}</p>
              <p className="text-[12.5px] text-ink-soft">
                {r.photos.length} photo{r.photos.length === 1 ? "" : "s"} · {r.photos.map((p) => p.slot).join(", ")}
                {r.takenBy.length ? ` · by ${r.takenBy.join(", ")}` : ""}
                {r.lastTakenAt ? ` · ${when(r.lastTakenAt)}` : ""}
              </p>
            </div>
            <div className="text-right text-[12.5px] text-ink-soft">
              <p>{r.sheetReady ? "Sheet ready" : "No sheet yet"}</p>
              <p>{r.generations} image{r.generations === 1 ? "" : "s"}</p>
            </div>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-[14px] text-ink-soft">No products captured yet.</p>}
      </div>
    </div>
  );
}
