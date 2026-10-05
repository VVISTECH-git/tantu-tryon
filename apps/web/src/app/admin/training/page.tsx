import Link from "next/link";
import { redirect } from "next/navigation";
import { canReviewLabels } from "@/lib/partLabels";
import { requirePage } from "@/lib/page-auth";
import { TRAINING_SHOPS, photoLink, previewKey, productFromIndex, readProduct, shopIndex, trainingConfigured } from "@/lib/trainingStore";
import { TrainingPhotos } from "./TrainingPhotos";

export const dynamic = "force-dynamic";

const PER_PAGE = 24;
const SHOP_NAMES: Record<string, string> = { itokri: "iTokri", shobitam: "Shobitam", holyweaves: "Holy Weaves" };

function href(f: { shop?: string; page?: number; open?: string; q?: string }): string {
  const sp = new URLSearchParams();
  if (f.shop) sp.set("shop", f.shop);
  if (f.open) sp.set("open", f.open);
  if (f.q) sp.set("q", f.q);
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  const s = sp.toString();
  return `/admin/training${s ? `?${s}` : ""}`;
}

/**
 * The training data in its own bucket (5 Oct): the shop photos copied for
 * training, per product. Read straight from the bucket; a photo's kind
 * (full / fabric / poster) is corrected here and written back.
 */
export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ shop?: string; page?: string; open?: string; q?: string }> }) {
  const account = await requirePage("/admin/training");
  if (!canReviewLabels(account)) redirect("/app");
  const sp = await searchParams;
  const shop = TRAINING_SHOPS.find((s) => s === sp.shop) ?? "itokri";
  const q = sp.q?.trim() || undefined;

  const tabs = (
    <nav className="mt-4 flex flex-wrap gap-1 border-b border-line text-[13.5px]">
      {TRAINING_SHOPS.map((s) => (
        <Link
          key={s}
          href={href({ shop: s })}
          aria-current={s === shop ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 ${s === shop ? "border-accent font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
        >
          {SHOP_NAMES[s]}
        </Link>
      ))}
    </nav>
  );

  if (!trainingConfigured()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Training data</h1>
        <p className="mt-3 text-[14px] text-ink-soft">The training bucket is not connected yet: its four TRAIN_R2_ settings are missing on the server.</p>
      </div>
    );
  }

  // The whole shop from its index: one read, kept in memory a few minutes.
  const index = await shopIndex(shop);
  const all = index.map((p) => p.id);

  // One product: every photo, with what it is.
  if (sp.open) {
    const at = all.indexOf(sp.open);
    // Known to the index: only its live kinds and marks are read. Otherwise the slow way.
    const p = at >= 0 ? await productFromIndex(shop, index[at]!) : await readProduct(shop, sp.open);
    const back = href({ shop, q, page: at >= 0 ? Math.floor(at / PER_PAGE) + 1 : 1 });
    const prev = at > 0 ? all[at - 1] : null;
    const next = at >= 0 && at < all.length - 1 ? all[at + 1] : null;
    // Small copies on the page; the full photo opens on a tap.
    const [links, previews] = p
      ? await Promise.all([
          Promise.all(p.photos.map((f) => photoLink(`${shop}/${p.id}/${f}`))),
          Promise.all(p.photos.map((f) => photoLink(previewKey(shop, p, f)))),
        ])
      : [[], []];
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13.5px]">
          <Link href={back} className="text-accent underline">‹ {SHOP_NAMES[shop]} products</Link>
          <span className="flex items-center gap-3">
            {prev ? <Link href={href({ shop, open: prev })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">‹ Previous</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">‹ Previous</span>}
            {at >= 0 && <span className="tabular-nums text-ink-faint">{at + 1} of {all.length}</span>}
            {next ? <Link href={href({ shop, open: next })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">Next ›</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">Next ›</span>}
          </span>
        </div>
        {!p ? (
          <p className="mt-6 text-[14px] text-ink-soft">That product is not in the bucket.</p>
        ) : (
          <>
            <h1 className="mt-5 text-[20px] font-semibold tracking-tight">{p.title ?? p.id}</h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              {SHOP_NAMES[shop]} · {p.id}
              {p.url && (
                <>
                  {" · "}
                  <a href={p.url} target="_blank" rel="noreferrer" className="underline">on their website</a>
                </>
              )}
            </p>
            <p className="mt-3 text-[13px] text-ink-soft">
              <b className="text-ink">Full</b> = the saree draped, what the model should make. <b className="text-ink">Fabric</b> = close-ups,
              blouse piece, folded or held: what goes in. <b className="text-ink">Poster</b> = left out. Tap to correct; it saves at once.
              <br />
              <b className="text-ink">Mark parts</b> on the fabric photos <i>and</i> the worn ones: body, pallu, borders, blouse. That is how the model
              learns where each part goes when the saree is worn.
            </p>
            <TrainingPhotos
              shop={shop}
              id={p.id}
              photos={p.photos.map((f, i) => ({
                file: f,
                full: links[i]!,
                preview: previews[i]!,
                kind: p.kinds[f] ?? null,
                regions: p.marks[f]?.regions ?? [],
                markedBy: p.marks[f]?.by ?? null,
              }))}
            />
          </>
        )}
      </div>
    );
  }

  // The list: newest product numbers first, a page at a time.
  const needle = q?.toLowerCase();
  const matching = needle ? index.filter((p) => p.id.includes(needle) || (p.title ?? "").toLowerCase().includes(needle)) : index;
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  // Straight from the index: no reads of the bucket, only links signed here.
  const products = matching
    .slice((page - 1) * PER_PAGE, page * PER_PAGE)
    .map((p) => ({ ...p, url: null, small: new Set(p.small), marks: {} as Record<string, never> }));
  const ids = products.map((p) => p.id);
  const thumbs = await Promise.all(
    products.map((p) => {
      const f = p.photos.find((n) => p.kinds[n] === "full") ?? p.photos[0];
      return f ? photoLink(previewKey(shop, p, f)) : Promise.resolve(null);
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-semibold tracking-tight">Training data</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink-soft">
        Saree photos from partner shops, kept in their own private bucket. Open a saree to check what each photo is.
      </p>
      {tabs}
      <form action="/admin/training" className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="shop" value={shop} />
        <input name="q" defaultValue={q ?? ""} placeholder="Find a saree: number or name" className="w-56 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]" />
        <button type="submit" className="rounded-lg border border-line px-4 py-2 text-[14px] hover:border-ink-faint">Find</button>
        {q && <Link href={href({ shop })} className="self-center text-[13px] text-ink-soft underline">Clear</Link>}
      </form>
      <p className="mt-3 text-[12.5px] tabular-nums text-ink-faint">
        {matching.length === 0 ? "No products." : `${(page - 1) * PER_PAGE + 1}–${(page - 1) * PER_PAGE + ids.length} of ${matching.length} products`}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => {
          const counts = { full: 0, fabric: 0, poster: 0 } as Record<string, number>;
          for (const f of p.photos) counts[p.kinds[f] ?? "?"] = (counts[p.kinds[f] ?? "?"] ?? 0) + 1;
          return (
            <Link key={p.id} href={href({ shop, open: p.id, q })} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2 hover:border-ink-faint">
              <div className="overflow-hidden rounded-lg bg-surface-2">
                {thumbs[i] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[i]!} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                )}
              </div>
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{p.title ?? p.id}</p>
              <p className="text-[12px] tabular-nums text-ink-soft">
                {p.photos.length} photos · {counts.full} full · {counts.fabric} fabric
                {Object.keys(p.marks).length > 0 && <span className="font-semibold text-good"> · {Object.keys(p.marks).length} marked</span>}
                {Object.keys(p.kinds).length === 0 && <span className="text-ink-faint"> · not sorted yet</span>}
              </p>
            </Link>
          );
        })}
      </div>

      {pages > 1 && (
        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13.5px]" aria-label="Pages">
          {page > 1 ? <Link href={href({ shop, q, page: page - 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">‹ Previous</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">‹ Previous</span>}
          <span className="tabular-nums text-ink-soft">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ shop, q, page: page + 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">Next ›</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">Next ›</span>}
        </nav>
      )}
    </div>
  );
}
