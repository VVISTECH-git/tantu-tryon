"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui";

/** Delete this product; images already made from it are kept. Two taps. */
export function DeleteProduct({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <p className="mt-8 text-[13px]">
      {busy ? (
        <span className="text-ink-faint">Deleting…</span>
      ) : (
        <ConfirmButton
          label={`Delete ${name}`}
          confirmLabel="Tap again to delete (generated images are kept)"
          onConfirm={() => {
            setBusy(true);
            setProblem(null);
            void fetch(`/api/garments/${id}`, { method: "DELETE" })
              .then(async (res) => {
                if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not delete it.");
                router.push("/admin/products");
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
