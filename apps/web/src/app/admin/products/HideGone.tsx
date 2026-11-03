"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmButton } from "@/components/ui";

const API = "/api/platform/products/hide-gone";

/**
 * Products whose photos were deleted from storage (3 Nov), in two steps:
 * hide them (Undo shows them again), then, if wanted, delete the hidden ones
 * for good. A product with images made from it stays hidden instead.
 */
export function HideGone() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = () =>
    fetch(API, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ hidden?: number }>)
      .then((b) => setHidden(b.hidden ?? 0))
      .catch(() => undefined);
  useEffect(() => {
    void refresh();
  }, []);

  const call = (method: "POST" | "PATCH" | "DELETE") => {
    setBusy(true);
    setProblem(null);
    void fetch(API, { method })
      .then(async (res) => {
        const b = (await res.json().catch(() => ({}))) as { hidden?: number; kept?: number; shown?: number; removed?: number; keptHidden?: number; error?: string };
        if (!res.ok) throw new Error(b.error ?? "Could not do that.");
        setNote(
          method === "POST"
            ? `Hidden ${b.hidden ?? 0}; ${b.kept ?? 0} with photos kept.`
            : method === "PATCH"
              ? `Deleted ${b.removed ?? 0} for good.${b.keptHidden ? ` ${b.keptHidden} have AI images made from them, so they stay hidden.` : ""}`
              : `Shown again: ${b.shown ?? 0}.`,
        );
        await refresh();
        router.refresh();
      })
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : "Could not do that."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mt-3 flex flex-col gap-2 text-[13px]">
      {busy ? (
        <span className="text-ink-faint">Working… this can take a minute.</span>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <ConfirmButton
            label="1. Hide products whose photos are deleted"
            confirmLabel="Tap again to hide them (Undo brings them back)"
            onConfirm={() => call("POST")}
          />
          {hidden > 0 && (
            <>
              <ConfirmButton
                label={`2. Delete the ${hidden} hidden products for good`}
                confirmLabel="Tap again: this cannot be undone"
                onConfirm={() => call("PATCH")}
              />
              <button type="button" className="text-accent underline" onClick={() => call("DELETE")}>
                Undo: show the {hidden} again
              </button>
            </>
          )}
        </div>
      )}
      {note && <span className="text-ink-soft">{note}</span>}
      {problem && <span className="text-red-700">{problem}</span>}
    </div>
  );
}
