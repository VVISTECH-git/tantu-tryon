import Link from "next/link";
import { redirect } from "next/navigation";
import { canReviewLabels } from "@/lib/partLabels";
import { requirePage } from "@/lib/page-auth";
import { TRAINING_SHOPS, markingProgress, markingSet, photoLink, previewKey, productFromIndex, readProduct, shopIndex, trainingConfigured } from "@/lib/trainingStore";
import { Photo } from "./Photo";
import { TrainingPhotos } from "./TrainingPhotos";

export const dynamic = "force-dynamic";

const PER_PAGE = 24;
const SHOP_NAMES: Record<string, string> = { itokri: "iTokri", shobitam: "Shobitam", holyweaves: "Holy Weaves" };

function href(f: { shop?: string; page?: number; open?: string; q?: string; view?: string; set?: boolean }): string {
  const sp = new URLSearchParams();
  if (f.view) sp.set("view", f.view);
  if (f.set) sp.set("set", "1");
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
export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ shop?: string; page?: string; open?: string; q?: string; view?: string; set?: string }> }) {
  const account = await requirePage("/admin/training");
  if (!canReviewLabels(account)) redirect("/app");
  const sp = await searchParams;
  const shop = TRAINING_SHOPS.find((s) => s === sp.shop) ?? "itokri";
  const q = sp.q?.trim() || undefined;

  const tabs = (
    <nav className="mt-4 flex flex-wrap gap-1 border-b border-line text-[13.5px]">
      <Link
        href={href({ view: "tomark" })}
        aria-current={sp.view === "tomark" ? "page" : undefined}
        className={`-mb-px border-b-2 px-3 py-2 ${sp.view === "tomark" ? "border-accent font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
      >
        To mark
      </Link>
      {TRAINING_SHOPS.map((s) => (
        <Link
          key={s}
          href={href({ shop: s })}
          aria-current={s === shop && sp.view !== "tomark" ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 ${s === shop && sp.view !== "tomark" ? "border-accent font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
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

  // The sarees chosen to mark first, across the shops, with how far each one is.
  if (sp.view === "tomark" && !sp.open) {
    const [set, progress] = await Promise.all([markingSet(), markingProgress()]);
    const need = (it: (typeof set)[number]) => 1 + it.fabric.length;
    const done = set.filter((it) => (progress[`${it.shop}/${it.id}`] ?? 0) >= need(it)).length;
    const pages = Math.max(1, Math.ceil(set.length / PER_PAGE));
    const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
    const items = set.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const thumbs = await Promise.all(
      items.map(async (it) => {
        const entry = (await shopIndex(it.shop)).find((x) => x.id === it.id);
        if (!entry) return null;
        return photoLink(previewKey(it.shop, { ...entry, url: null, small: new Set(entry.small), marks: {} }, it.worn));
      }),
    );
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Training data</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-soft">
          300 sarees, all different, to mark first. In each, mark the <b className="text-ink">worn photo</b> and its{" "}
          <b className="text-ink">fabric photos</b> (labelled &ldquo;Mark this&rdquo;), so the model learns where each part goes when worn.
        </p>
        {tabs}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-good" style={{ width: `${set.length ? (done / set.length) * 100 : 0}%` }} />
          </div>
          <span className="text-[13px] tabular-nums text-ink-soft">
            <b className="text-ink">{done}</b> of {set.length} sarees fully marked
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it, i) => {
            const marked = Math.min(progress[`${it.shop}/${it.id}`] ?? 0, need(it));
            const complete = marked >= need(it);
            return (
              <Link key={`${it.shop}/${it.id}`} href={href({ shop: it.shop, open: it.id, set: true })} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2 hover:border-ink-faint">
                <Photo src={thumbs[i] ?? null} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{it.title ?? it.id}</p>
                <p className={`text-[12px] tabular-nums ${complete ? "font-semibold text-good" : "text-ink-soft"}`}>
                  {SHOP_NAMES[it.shop]} · {complete ? "done ✓" : `${marked} of ${need(it)} photos marked`}
                </p>
              </Link>
            );
          })}
        </div>
        {pages > 1 && (
          <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13.5px]" aria-label="Pages">
            {page > 1 ? <Link href={href({ view: "tomark", page: page - 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">‹ Previous</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">‹ Previous</span>}
            <span className="tabular-nums text-ink-soft">Page {page} of {pages}</span>
            {page < pages ? <Link href={href({ view: "tomark", page: page + 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">Next ›</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">Next ›</span>}
          </nav>
        )}
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
    // From the "To mark" list, Previous / Next walk that list (across shops); otherwise the shop.
    const set = sp.set ? await markingSet() : null;
    const inSet = set ? set.findIndex((it) => it.shop === shop && it.id === sp.open) : -1;
    const item = set && inSet >= 0 ? set[inSet]! : null;
    const back = set
      ? href({ view: "tomark", page: inSet >= 0 ? Math.floor(inSet / PER_PAGE) + 1 : 1 })
      : href({ shop, q, page: at >= 0 ? Math.floor(at / PER_PAGE) + 1 : 1 });
    const prevHref = set
      ? inSet > 0
        ? href({ shop: set[inSet - 1]!.shop, open: set[inSet - 1]!.id, set: true })
        : null
      : at > 0
        ? href({ shop, open: all[at - 1] })
        : null;
    const nextHref = set
      ? inSet >= 0 && inSet < set.length - 1
        ? href({ shop: set[inSet + 1]!.shop, open: set[inSet + 1]!.id, set: true })
        : null
      : at >= 0 && at < all.length - 1
        ? href({ shop, open: all[at + 1] })
        : null;
    const position = set ? (inSet >= 0 ? `${inSet + 1} of ${set.length} to mark` : null) : at >= 0 ? `${at + 1} of ${all.length}` : null;
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
          <Link href={back} className="text-accent underline">‹ {set ? "To mark" : `${SHOP_NAMES[shop]} products`}</Link>
          <span className="flex items-center gap-3">
            {prevHref ? <Link href={prevHref} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">‹ Previous</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">‹ Previous</span>}
            {position && <span className="tabular-nums text-ink-faint">{position}</span>}
            {nextHref ? <Link href={nextHref} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">Next ›</Link> : <span className="rounded-full border border-line-soft px-3 py-1 text-ink-faint">Next ›</span>}
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
              toMark={item ? [item.worn, ...item.fabric] : undefined}
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
                <Photo src={thumbs[i] ?? null} alt="" className="aspect-[3/4] w-full object-cover" />
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
