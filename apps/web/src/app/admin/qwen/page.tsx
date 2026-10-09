import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { db, garments, generations } from "@/db";
import { poseFor } from "@/content/poses";
import { garmentType as typeOf } from "@/content/shots";
import { requirePage } from "@/lib/page-auth";
import { QWEN_PROVIDER } from "@/lib/qwenPrompt";
import { assetUrl } from "@/lib/storage";
import { QwenGrid, type QwenItem } from "./QwenGrid";

export const dynamic = "force-dynamic";

const PER_PAGE = 24;
const SHOWS = { done: "Made", waiting: "Waiting", failed: "Failed", all: "All" } as const;
type Show = keyof typeof SHOWS;

/**
 * Our own Qwen's images (9 Oct, user: "a new page for qwen generations, so I can show them to
 * Balaram"): each one beside the product photo and Gemini's image of the same product, newest first.
 */
export default async function QwenPage({ searchParams }: { searchParams: Promise<{ show?: string; page?: string }> }) {
  await requirePage("/admin/qwen", { platform: true });
  const sp = await searchParams;
  const show: Show = sp.show && sp.show in SHOWS ? (sp.show as Show) : "done";

  const rows = await db
    .select({
      id: generations.id,
      garmentId: generations.garmentId,
      promptId: generations.promptId,
      status: generations.status,
      imageKey: generations.imageKey,
      ms: generations.ms,
      error: generations.error,
      promptText: generations.promptText,
      startedAt: generations.startedAt,
      productCode: garments.productCode,
      title: garments.title,
      garmentType: garments.garmentType,
      parts: garments.parts,
    })
    .from(generations)
    .innerJoin(garments, eq(garments.id, generations.garmentId))
    .where(and(eq(generations.provider, QWEN_PROVIDER), isNull(garments.deletedAt)))
    .orderBy(desc(generations.startedAt));

  const waiting = (s: string) => s === "queued" || s === "running";
  const counts = {
    done: rows.filter((r) => r.status === "done" && r.imageKey).length,
    waiting: rows.filter((r) => waiting(r.status)).length,
    failed: rows.filter((r) => r.status === "failed" || r.status === "refused").length,
    all: rows.length,
  };
  const list = rows.filter((r) =>
    show === "done" ? r.status === "done" && r.imageKey : show === "waiting" ? waiting(r.status) : show === "failed" ? r.status === "failed" || r.status === "refused" : true,
  );
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const times = rows.filter((r) => r.status === "done" && r.ms).map((r) => r.ms!);
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000) : null;

  // Gemini's latest image of the same products, the same pose first, for the comparison.
  const ids = [...new Set(shown.map((r) => r.garmentId))];
  const gem = ids.length
    ? await db
        .select({ garmentId: generations.garmentId, promptId: generations.promptId, imageKey: generations.imageKey })
        .from(generations)
        .where(and(inArray(generations.garmentId, ids), eq(generations.status, "done"), inArray(generations.provider, ["gemini", "openrouter"])))
        .orderBy(desc(generations.startedAt))
    : [];
  const geminiFor = (garmentId: string, promptId: string) =>
    (gem.find((g) => g.garmentId === garmentId && g.promptId === promptId && g.imageKey) ?? gem.find((g) => g.garmentId === garmentId && g.imageKey))?.imageKey ?? null;

  const items: QwenItem[] = shown.map((r) => {
    const photo = r.parts.find((p) => p.key);
    const g = geminiFor(r.garmentId, r.promptId);
    const pose = poseFor(r.garmentType, r.promptId)?.title;
    return {
      id: r.id,
      title: r.productCode ?? r.title,
      detail: [typeOf(r.garmentType).label, pose ? `${r.promptId} · ${pose}` : r.promptId].join(" · "),
      when: new Date(r.startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
      status: r.status,
      seconds: r.ms ? Math.round(r.ms / 1000) : null,
      error: r.error,
      prompt: r.promptText,
      images: [
        { label: "Product photo", src: photo ? assetUrl(photo.thumbKey ?? photo.previewKey ?? photo.key!) : null, full: photo?.key ? assetUrl(photo.key) : null },
        { label: "Qwen (ours)", src: r.imageKey ? assetUrl(r.imageKey) : null, full: r.imageKey ? assetUrl(r.imageKey) : null },
        { label: "Gemini (paid)", src: g ? assetUrl(g) : null, full: g ? assetUrl(g) : null },
      ],
    };
  });

  const href = (f: { show?: Show; page?: number }) => {
    const q = new URLSearchParams({ ...((f.show ?? show) !== "done" ? { show: f.show ?? show } : {}), ...((f.page ?? 1) > 1 ? { page: String(f.page) } : {}) });
    return `/admin/qwen${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-[24px] font-semibold tracking-tight">Qwen</h1>
      <p className="mt-1 text-[13px] text-ink-soft">
        Images made by our own Qwen on the rented GPU, each beside the product photo and Gemini&apos;s image of the same product. No charge per image.
        {avg !== null && <> Average {avg} s per image.</>}
      </p>

      <p className="mt-4 flex flex-wrap gap-2 text-[13px]">
        {(Object.keys(SHOWS) as Show[]).map((s) => (
          <Link key={s} href={href({ show: s, page: 1 })} className={`rounded-full px-3 py-1 ${s === show ? "bg-accent font-semibold text-white" : "text-ink-soft hover:text-ink"}`}>
            {SHOWS[s]} ({counts[s]})
          </Link>
        ))}
      </p>

      {shown.length === 0 && <p className="mt-8 text-[14px] text-ink-soft">Nothing here yet.</p>}

      <QwenGrid key={`${show}-${page}`} items={items} />

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
