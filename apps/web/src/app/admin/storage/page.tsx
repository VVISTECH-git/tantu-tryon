import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { loadStorageUsage } from "@/lib/storageUsage";

export const dynamic = "force-dynamic";

/** Cloudflare R2's free storage allowance; past it, $0.015 per GB a month. Egress is free. */
const FREE_BYTES = 10 * 1024 ** 3;

function size(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * How much storage Tantu's photos and images take, by kind and by product,
 * and how much of it nothing points at any more.
 */
export default async function StoragePage() {
  await requirePage("/admin/storage", { platform: true });
  const u = await loadStorageUsage();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="label">
        <Link href="/admin/spend" className="hover:text-ink">
          Platform
        </Link>
      </p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">Storage</h1>
      <p className="mt-1 text-[13px] text-ink-soft">
        Every photo taken, every sheet sent to the image model and every generated image, as stored in the bucket
        {u.bucket ? ` ${u.bucket}` : ""}. Read fresh on each visit.
      </p>

      {!u.configured ? (
        <p className="mt-6 text-[14px] text-danger">Storage is not set up here: {u.missing.join(", ")} missing.</p>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <p className="text-[12px] uppercase tracking-wide text-ink-faint">Tantu uses</p>
            <p className="mt-1 text-[30px] font-semibold tabular-nums">{size(u.totalBytes)}</p>
            <p className="text-[13px] text-ink-soft tabular-nums">
              {u.totalCount.toLocaleString("en-IN")} files · {((u.totalBytes / FREE_BYTES) * 100).toFixed(1)}% of Cloudflare R2&apos;s free 10 GB
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ground">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (u.totalBytes / FREE_BYTES) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-ink-faint">Past 10 GB, R2 charges $0.015 per GB a month. Downloads are free.</p>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-4">
            {u.byKind.map((k) => (
              <div key={k.kind} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-[12px] uppercase tracking-wide text-ink-faint">{k.label}</p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums">{size(k.bytes)}</p>
                <p className="text-[12.5px] text-ink-soft tabular-nums">
                  {k.count.toLocaleString("en-IN")} files · avg {size(k.bytes / Math.max(1, k.count))}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="text-[15px] font-semibold">Not used any more</h2>
            <p className="mt-1 text-[13px] text-ink-soft tabular-nums">
              {u.orphanCount.toLocaleString("en-IN")} files, {size(u.orphanBytes)}: in the bucket, but no product or image points at them (replaced
              photos, rebuilt sheets). Safe to delete; nothing deletes them yet.
            </p>
          </section>

          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="text-[15px] font-semibold">Largest products</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead className="text-left text-[12px] uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="py-1.5 pr-2">Product</th>
                    <th className="text-right">Files</th>
                    <th className="text-right">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {u.byProduct.map((p) => (
                    <tr key={p.garmentId} className="border-t border-line-soft">
                      <td className="py-2 pr-2">
                        {p.productCode ? (
                          <Link href={`/admin/generations?product=${encodeURIComponent(p.productCode)}`} className="underline">
                            {p.productCode}
                          </Link>
                        ) : (
                          <span className="text-ink-soft">{p.title ?? "Deleted product"}</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{p.count}</td>
                      <td className="text-right tabular-nums">{size(p.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
