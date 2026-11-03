"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui";

/** Delete this product; images already made from it are kept. Two taps. */
export function DeleteProduct({ id, name, compact = false }: { id: string; name: string; compact?: boolean }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <p className={compact ? "shrink-0 text-[12.5px]" : "mt-8 text-[13px]"}>
      {busy ? (
        <span className="text-ink-faint">Deleting…</span>
      ) : (
        <ConfirmButton
          label={compact ? "Delete" : `Delete ${name}`}
          confirmLabel={compact ? "Tap again" : "Tap again to delete (generated images are kept)"}
          onConfirm={() => {
            setBusy(true);
            setProblem(null);
            void fetch(`/api/garments/${id}`, { method: "DELETE" })
              .then(async (res) => {
                if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not delete it.");
                // From the list, stay on it; from an opened product, back to the list.
                if (!compact) router.push("/admin/products");
                router.refresh();
              })
              .catch((e: unknown) => {
                setProblem(e instanceof Error ? e.message : "Could not delete it.");
                setBusy(false);
              });
          }}
        />
      )}
      {problem && <span className="ml-3 text-danger">{problem}</span>}
    </p>
  );
}
