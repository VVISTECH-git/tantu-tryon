import Link from "next/link";
import { redirect } from "next/navigation";
import { canReviewLabels, listLabels, PART_COLOURS } from "@/lib/partLabels";
import { requirePage } from "@/lib/page-auth";
import { LabelCard } from "./LabelCard";

export const dynamic = "force-dynamic";

const SHOW = [
  ["pending", "To check"],
  ["wrong", "Wrong"],
  ["approved", "Approved"],
  ["all", "All"],
] as const;

/**
 * Training photos for Tantu's own part finder (4 Oct): each photo with its
 * parts coloured and named, for operations staff to approve or flag with a
 * note. Marked on the laptop; flagged ones go back there to be fixed.
 */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const account = await requirePage("/admin/labels");
  if (!canReviewLabels(account)) redirect("/app");
  const { show: asked } = await searchParams;
  const show = SHOW.some(([k]) => k === asked) ? asked! : "pending";
  const all = await listLabels();
  const count = (k: string) => (k === "all" ? all.length : all.filter((r) => r.status === k).length);
  const rows = show === "all" ? all : all.filter((r) => r.status === show);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-semibold tracking-tight">Saree parts</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink-soft">
        Training photos for Tantu&apos;s own part finder. Check that every coloured area is the right part of the saree, then tap
        Approve, or Wrong with a note on what to fix. Tap a photo to see it without the colours.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
        {Object.entries(PART_COLOURS).map(([name, colour]) => (
          <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
            <i className="inline-block size-3 rounded-[3px]" style={{ background: colour }} />
            {name}
          </span>
        ))}
      </div>

      <nav className="mt-5 flex flex-wrap gap-1 border-b border-line text-[13.5px]">
        {SHOW.map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/labels?show=${k}`}
            aria-current={k === show ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 ${k === show ? "border-accent font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {label} <span className="tabular-nums text-ink-faint">{count(k)}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 && (
        <p className="mt-8 text-[14px] text-ink-soft">
          {all.length === 0 ? "No photos uploaded yet." : show === "pending" ? "Nothing left to check." : "None here."}
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {rows.map((r) => (
          <LabelCard
            key={`${r.id}-${r.updatedAt.getTime()}`}
            id={r.id}
            no={r.taskNo}
            source={r.source}
            width={r.width}
            height={r.height}
            regions={r.regions}
            style={r.style}
            palluKind={r.palluKind}
            status={r.status}
            note={r.note}
            reviewedBy={r.reviewedBy}
            reviewedAt={r.reviewedAt?.toISOString() ?? null}
            version={r.updatedAt.getTime()}
          />
        ))}
      </div>
    </div>
  );
}
