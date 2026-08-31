"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approximateBytes,
  deleteBatch,
  deleteRender,
  listRenders,
  type StoredRender,
} from "@/lib/library";
import { downloadDataUrl, formatBytes } from "@/lib/image";
import { Lightbox } from "@/components/Lightbox";
import { ConfirmButton } from "@/components/ui";

export default function LibraryPage() {
  const [records, setRecords] = useState<StoredRender[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    void listRenders().then(setRecords);
  }, []);

  const filtered = useMemo(() => {
    if (!records) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      `${record.title} ${record.garment} ${record.poseName} ${record.scene}`
        .toLowerCase()
        .includes(needle),
    );
  }, [records, query]);

  const batches = useMemo(() => {
    const map = new Map<string, StoredRender[]>();
    for (const record of filtered) {
      const list = map.get(record.batchId) ?? [];
      list.push(record);
      map.set(record.batchId, list);
    }
    return [...map.entries()].map(([batchId, items]) => ({ batchId, items }));
  }, [filtered]);

  const flat = useMemo(() => batches.flatMap((b) => b.items), [batches]);

  async function refresh() {
    setRecords(await listRenders());
  }

  if (!records) {
    return (
      <main className="mx-auto max-w-[1680px] px-6 py-10">
        <div className="working h-40 rounded-2xl border border-line" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1680px] px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <h1 className="display text-[32px]">Library</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {records.length} render{records.length === 1 ? "" : "s"} ·{" "}
            {formatBytes(approximateBytes(records))} kept on this machine
          </p>
        </div>
        {records.length > 0 && (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by design, garment or pose"
            aria-label="Search the library"
            className="ml-auto w-full max-w-sm rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] outline-none transition placeholder:text-ink-faint focus:border-accent"
          />
        )}
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10">
          <p className="display text-[22px]">Nothing here yet.</p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Renders are kept here so a design can be re-shot, compared against its fabric and sent to
            a storefront later. Every tool in this market deletes yours the moment it hands them
            over, which sounds like privacy and behaves like data loss.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[15px] text-ink-soft">Nothing matches “{query}”.</p>
      ) : (
        <div className="space-y-12">
          {batches.map(({ batchId, items }) => {
            const first = items[0]!;
            return (
              <section key={batchId}>
                <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h2 className="display text-[20px]">{first.title}</h2>
                  <span className="label">
                    {first.garment} · {first.mode} · {new Date(first.createdAt).toLocaleString()}
                  </span>
                  <ConfirmButton
                    className="ml-auto"
                    label="delete set"
                    confirmLabel={`Delete ${items.length}`}
                    onConfirm={async () => {
                      await deleteBatch(batchId);
                      await refresh();
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 2xl:grid-cols-6">
                  {items.map((record) => (
                    <figure
                      key={record.id}
                      className="group relative overflow-hidden rounded-2xl border border-line bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(flat.findIndex((r) => r.id === record.id))}
                        className="block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={record.image}
                          alt={record.poseName}
                          className="aspect-4/5 w-full object-cover"
                        />
                      </button>
                      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3.5 pb-2.5 pt-9 text-[13px] font-medium text-white">
                        {record.poseName}
                      </figcaption>
                      <div className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          title="Download"
                          aria-label={`Download ${record.poseName}`}
                          onClick={() =>
                            downloadDataUrl(record.image, `${record.title}-${record.poseId}.png`)
                          }
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[14px] text-ink-soft shadow-sm hover:text-ink"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          title="Delete this render"
                          aria-label={`Delete ${record.poseName}`}
                          onClick={() => setArmed(record.id)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[14px] text-ink-soft shadow-sm hover:text-danger"
                        >
                          ×
                        </button>
                      </div>

                      {armed === record.id && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/95 px-4 text-center">
                          <p className="text-[14px] font-medium">Delete this render?</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                setArmed(null);
                                await deleteRender(record.id);
                                await refresh();
                              }}
                              className="rounded-full bg-danger px-4 py-1.5 text-[13px] font-medium text-white transition hover:brightness-110"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setArmed(null)}
                              className="rounded-full border border-line px-4 py-1.5 text-[13px] text-ink-soft transition hover:text-ink"
                            >
                              Keep
                            </button>
                          </div>
                        </div>
                      )}
                    </figure>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {open !== null && flat[open] && (
        <Lightbox
          item={{
            poseName: flat[open].poseName,
            dataUrl: flat[open].image,
            prompt: flat[open].prompt,
            provider: flat[open].provider,
            model: flat[open].model,
            ms: flat[open].ms,
          }}
          reference={flat[open].referenceThumb}
          filenameStem={`${flat[open].title}-${flat[open].poseId}`}
          onClose={() => setOpen(null)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < flat.length - 1 ? () => setOpen(open + 1) : undefined}
        />
      )}
    </main>
  );
}
