import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { db, garments, generations } from "@/db";
import { GARMENT_TYPES, garmentType as typeOf } from "@/content/shots";
import { poseFor } from "@/content/poses";
import { requirePage } from "@/lib/page-auth";
import { assetUrl } from "@/lib/storage";
import { ReviewButtons } from "./ReviewButtons";

export const dynamic = "force-dynamic";

const PER_PAGE = 24;

/**
 * Judge the made images against their product photos, one type at a time (8 Oct): the
 * product photo beside the image, Good / Not good. The verdict is the generation's own,
 * so only the good pairs go into Qwen's training set.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ type?: string; show?: string; page?: string }> }) {
  await requirePage("/admin/review", { platform: true });
  const sp = await searchParams;
  const type = GARMENT_TYPES.some((t) => t.value === sp.type) ? sp.type! : "frock";
  const show = sp.show === "good" || sp.show === "bad" || sp.show === "todo" ? sp.show : "all";

  const rows = await db
    .select({
      id: generations.id,
      garmentId: generations.garmentId,
      promptId: generations.promptId,
      model: generations.model,
      imageKey: generations.imageKey,
      verdict: generations.verdict,
      startedAt: generations.startedAt,
      productCode: garments.productCode,
      parts: garments.parts,
    })
    .from(generations)
    .innerJoin(garments, eq(garments.id, generations.garmentId))
    .where(and(eq(garments.garmentType, type), eq(generations.status, "done"), isNull(garments.deletedAt), inArray(generations.provider, ["gemini", "openrouter", "qwen-local"])))
    .orderBy(desc(generations.startedAt));

  // The latest image per product.
  const seen = new Set<string>();
  const latest = rows.filter((r) => r.imageKey && !seen.has(r.garmentId) && seen.add(r.garmentId)).sort((a, b) => (a.productCode ?? "").localeCompare(b.productCode ?? ""));
  const counts = { all: latest.length, good: latest.filter((r) => r.verdict === "approved").length, bad: latest.filter((r) => r.verdict === "rejected").length, todo: latest.filter((r) => !r.verdict).length };
  const list = latest.filter((r) => (show === "good" ? r.verdict === "approved" : show === "bad" ? r.verdict === "rejected" : show === "todo" ? !r.verdict : true));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (f: { type?: string; show?: string; page?: number }) => {
    const q = new URLSearchParams({ type: f.type ?? type, ...(f.show ?? show) !== "all" ? { show: f.show ?? show } : {}, ...((f.page ?? 1) > 1 ? { page: String(f.page) } : {}) });
    return `/admin/review?${q}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-[24px] font-semibold tracking-tight">Review</h1>
      <p className="mt-1 text-[13px] text-ink-soft">Each product&apos;s photo beside the image made from it. Mark each one; only the good ones are used to train Qwen.</p>

      <p className="mt-4 flex flex-wrap gap-2 text-[13px]">
        {GARMENT_TYPES.map((t) => (
          <Link key={t.value} href={href({ type: t.value, show: "all", page: 1 })} className={`rounded-full border px-3 py-1 ${t.value === type ? "border-accent text-accent" : "border-line"}`}>
            {t.label}
          </Link>
        ))}
      </p>
      <p className="mt-2 flex flex-wrap gap-2 text-[13px]">
        {(["all", "todo", "good", "bad"] as const).map((s) => (
          <Link key={s} href={href({ show: s, page: 1 })} className={`rounded-full px-3 py-1 ${s === show ? "bg-accent font-semibold text-white" : "text-ink-soft hover:text-ink"}`}>
            {{ all: "All", todo: "To check", good: "Good", bad: "Not good" }[s]} ({counts[s]})
          </Link>
        ))}
      </p>

      {shown.length === 0 && <p className="mt-8 text-[14px] text-ink-soft">No {typeOf(type).label.toLowerCase()} images here yet.</p>}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {shown.map((r) => {
          const photo = r.parts.find((p) => p.key);
          const input = photo ? assetUrl(photo.thumbKey ?? photo.previewKey ?? photo.key!) : null;
          const output = assetUrl(r.imageKey!);
          return (
            <article key={r.id} className={`rounded-xl border bg-surface p-3 ${r.verdict === "approved" ? "border-good" : r.verdict === "rejected" ? "border-danger" : "border-line"}`}>
              <header className="mb-2 flex items-baseline justify-between gap-2 text-[13px]">
                <b className="text-[14.5px]">{r.productCode}</b>
                <span className="text-ink-soft">
                  {r.promptId} · {poseFor(type, r.promptId)?.title ?? ""} · {r.model.replace("gemini-", "").replace("-image", "")}
                </span>
              </header>
              <div className="grid grid-cols-2 gap-2">
                {input ? (
                  <a href={photo?.key ? assetUrl(photo.key) : input} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={input} alt="Product photo" className="aspect-[3/4] w-full rounded-lg border border-line-soft object-cover" loading="lazy" />
                  </a>
                ) : (
                  <div className="aspect-[3/4] rounded-lg bg-surface-2" />
                )}
                <a href={output} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={output} alt="Made image" className="aspect-[3/4] w-full rounded-lg border border-line-soft object-cover" loading="lazy" />
                </a>
              </div>
              <ReviewButtons id={r.id} verdict={r.verdict as "approved" | "rejected" | null} />
            </article>
          );
        })}
      </div>

      {pages > 1 && (
        <nav className="mt-6 flex flex-wrap items-center gap-1 text-[13.5px]" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={`min-w-8 rounded-full px-2.5 py-1 text-center tabular-nums ${n === page ? "bg-accent font-semibold text-white" : "text-ink-soft hover:text-ink"}`}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
