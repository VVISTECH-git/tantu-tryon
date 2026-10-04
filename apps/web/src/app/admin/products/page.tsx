import Link from "next/link";
import { redirect } from "next/navigation";
import type { PartLabel } from "@/db";
import { canReviewLabels, labelsForProducts } from "@/lib/partLabels";
import { requirePage } from "@/lib/page-auth";
import { productInputsById, productRows } from "@/lib/productInputs";
import { LabelCard } from "../labels/LabelCard";
import { CropPhoto } from "./CropPhoto";
import { MarkPhoto } from "./MarkPhoto";
import { DeleteProduct } from "./DeleteProduct";

export const dynamic = "force-dynamic";

/** One product's marks in a word, for the list: what the supervisor still has to do. */
function marksSummary(labels: PartLabel[]): { text: string; tone: string } | null {
  if (labels.length === 0) return null;
  const wrong = labels.filter((l) => l.status === "wrong").length;
  const pending = labels.filter((l) => l.status === "pending").length;
  if (wrong) return { text: `Marks: ${wrong} wrong`, tone: "text-danger" };
  if (pending) return { text: `Marks: ${pending} to check`, tone: "text-turmeric" };
  return { text: "Marks approved", tone: "text-good" };
}

const PER_PAGE = 10;

/** The list's own address with these filters, leaving out the empty ones. */
function listHref(f: { by?: string; q?: string; page?: number; open?: string }): string {
  const sp = new URLSearchParams();
  if (f.open) sp.set("open", f.open);
  if (f.by) sp.set("by", f.by);
  if (f.q) sp.set("q", f.q);
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  const s = sp.toString();
  return `/admin/products${s ? `?${s}` : ""}`;
}

/** Products taken by this person and whose ID contains the search, in list order. */
function filtered<T extends { takenBy: string[]; productCode: string | null }>(rows: T[], by?: string, q?: string): T[] {
  const needle = q?.trim().toLowerCase();
  return rows.filter((r) => (!by || r.takenBy.includes(by)) && (!needle || (r.productCode ?? "").toLowerCase().includes(needle)));
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/**
 * Every product the phones have captured, newest first, with its photos,
 * who took them and when (28 Sep: to see what the photographer login has
 * done). One product opens its inputs: the photos, the input sheet and the
 * prompt each pose would send. Nothing here generates or costs anything.
 */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ by?: string; open?: string; q?: string; page?: string }> }) {
  // The platform admin sees every shop's products; the house shop's owner and
  // studio (the supervisor, 4 Oct) see their own, to check the parts marked on each photo.
  const account = await requirePage("/admin/products");
  const platform = account.platformAdmin;
  if (!platform && !canReviewLabels(account)) redirect("/app");
  const shop = platform ? undefined : account.id;
  const { by, open, q: rawQ, page: rawPage } = await searchParams;
  const q = rawQ?.trim() || undefined;

  if (open) {
    const [g, list, labels] = await Promise.all([productInputsById(open, shop), productRows(shop), labelsForProducts([open])]);
    const marked = new Map(labels.map((l) => [l.slot, l]));
    // Previous / Next walk the list in its own order (newest first), keeping its filter.
    const order = filtered(list, by, q);
    const at = order.findIndex((r) => r.id === open);
    const prev = at > 0 ? order[at - 1] : null;
    const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
    // Back to the list on the page this product is on.
    const back = listHref({ by, q, page: at >= 0 ? Math.floor(at / PER_PAGE) + 1 : 1 });
    const nav = (
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13.5px]">
        <Link href={back} className="text-accent underline">
          ‹ All products
        </Link>
        <span className="flex items-center gap-4">
          {prev ? (
            <Link href={listHref({ open: prev.id, by, q })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">
              ‹ Previous · {prev.productCode ?? "No product ID"}
            </Link>
          ) : (
            <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">‹ Previous</span>
          )}
          {at >= 0 && <span className="text-ink-faint tabular-nums">{at + 1} of {order.length}</span>}
          {next ? (
            <Link href={listHref({ open: next.id, by, q })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">
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
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.parts.map((p) => {
                const l = marked.get(p.slot);
                return (
                <figure key={p.slot}>
                  {l ? (
                    <LabelCard
                      key={l.updatedAt.getTime()}
                      title={p.slot}
                      id={l.id}
                      no={l.taskNo}
                      source={l.source}
                      width={l.width}
                      height={l.height}
                      regions={l.regions}
                      style={l.style}
                      palluKind={l.palluKind}
                      status={l.status}
                      note={l.note}
                      reviewedBy={l.reviewedBy}
                      reviewedAt={l.reviewedAt?.toISOString() ?? null}
                      version={l.updatedAt.getTime()}
                    />
                  ) : (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.previewUrl ?? p.url} alt={p.slot} className="max-h-72 w-full rounded-lg border border-line-soft bg-surface object-contain" />
                  </a>
                  )}
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
                    {p.width && p.height && (
                      <>
                        {" · "}
                        <CropPhoto garmentId={g.id} slot={p.slot} src={p.previewUrl ?? p.url} width={p.width} height={p.height} marked={!!l} />
                      </>
                    )}
                    {!l && p.width && p.height && (
                      <>
                        {" · "}
                        <span className="text-ink-faint">parts not marked yet: </span>
                        <MarkPhoto garmentId={g.id} slot={p.slot} src={p.previewUrl ?? p.url} width={p.width} height={p.height} />
                      </>
                    )}
                  </figcaption>
                </figure>
                );
              })}
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
            {platform && <DeleteProduct id={g.id} name={g.productCode ?? "this product"} />}
          </>
        )}
        <div className="mt-8">{nav}</div>
      </div>
    );
  }

  const all = await productRows(shop);
  const marks = await labelsForProducts(all.map((r) => r.id));
  const people = [...new Set(all.flatMap((r) => r.takenBy))].sort();
  const matching = filtered(all, by, q);
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(rawPage) || 1));
  const rows = matching.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {platform && (
        <p className="label">
          <Link href="/admin/spend" className="hover:text-ink">
            Platform
          </Link>
        </p>
      )}
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">Products</h1>
      <p className="mt-1 text-[13px] text-ink-soft">Every product captured on the phones, newest first. Open one to see its photos, input sheet and prompts.</p>

      <form action="/admin/products" className="mt-4 flex flex-wrap gap-2">
        {by && <input type="hidden" name="by" value={by} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Find a product ID, e.g. 9002"
          inputMode="search"
          className="w-64 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
        />
        <button type="submit" className="rounded-lg border border-line px-4 py-2 text-[14px] hover:border-ink-faint">
          Find
        </button>
        {q && (
          <Link href={listHref({ by })} className="self-center text-[13px] text-ink-soft underline">
            Clear
          </Link>
        )}
      </form>

      <p className="mt-3 flex flex-wrap gap-2 text-[13px]">
        <Link href={listHref({ q })} className={`rounded-full border px-3 py-1 ${!by ? "border-accent text-accent" : "border-line"}`}>
          Everyone ({all.length})
        </Link>
        {people.map((p) => (
          <Link
            key={p}
            href={listHref({ by: p, q })}
            className={`rounded-full border px-3 py-1 ${by === p ? "border-accent text-accent" : "border-line"}`}
          >
            {p} ({all.filter((r) => r.takenBy.includes(p)).length})
          </Link>
        ))}
      </p>

      <div className="mt-5 grid gap-3">
        {rows.map((r) => (
          <Link key={r.id} href={listHref({ open: r.id, by, q })} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3 hover:border-ink-faint">
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
              {(() => {
                const m = marksSummary(marks.filter((l) => l.garmentId === r.id));
                return m && <p className={`font-semibold ${m.tone}`}>{m.text}</p>;
              })()}
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="text-[14px] text-ink-soft">{q ? `No product ID with “${q}”.` : "No products captured yet."}</p>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13.5px]" aria-label="Pages">
          {page > 1 ? (
            <Link href={listHref({ by, q, page: page - 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">
              ‹ Previous 10
            </Link>
          ) : (
            <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">‹ Previous 10</span>
          )}
          <span className="flex flex-wrap items-center gap-1">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={listHref({ by, q, page: n })}
                aria-current={n === page ? "page" : undefined}
                className={`min-w-8 rounded-full px-2.5 py-1 text-center tabular-nums ${n === page ? "bg-accent font-semibold text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {n}
              </Link>
            ))}
          </span>
          {page < pages ? (
            <Link href={listHref({ by, q, page: page + 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">
              Next 10 ›
            </Link>
          ) : (
            <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">Next 10 ›</span>
          )}
        </nav>
      )}
      <p className="mt-3 text-[12.5px] tabular-nums text-ink-faint">
        {matching.length === 0 ? "" : `${(page - 1) * PER_PAGE + 1}–${(page - 1) * PER_PAGE + rows.length} of ${matching.length}`}
      </p>
    </div>
  );
}
