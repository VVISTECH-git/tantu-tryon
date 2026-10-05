"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PartRegion } from "@/db/schema";
import { MarkEditor } from "../labels/MarkEditor";

/**
 * Mark the parts on one training photo (5 Oct): body, pallu, borders, blouse, on the fabric
 * photos and on the worn ones alike, so the model learns where each part goes when worn.
 * Opens the full-size photo in the same marking tool as the Products page.
 */
export function MarkTrainingPhoto(props: { shop: string; id: string; file: string; src: string; regions: PartRegion[] }) {
  const router = useRouter();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(false);

  function open() {
    // The photo's own size first, so the marks sit exactly on it.
    setLoading(true);
    const img = new Image();
    img.onload = () => {
      setLoading(false);
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setLoading(false);
    img.src = props.src;
  }

  const marked = props.regions.length > 0;
  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className={`w-full rounded-md border px-2 py-1 text-[12.5px] font-semibold ${marked ? "border-line text-ink-soft hover:border-ink-faint" : "border-accent text-accent hover:bg-accent-wash"}`}
      >
        {loading ? "Opening…" : marked ? `✎ Fix marks (${props.regions.length})` : "Mark parts"}
      </button>
      {size && (
        <MarkEditor
          title={props.file}
          src={props.src}
          width={size.w}
          height={size.h}
          regions={props.regions}
          saveLabel="✓ Save marks"
          onClose={() => setSize(null)}
          onSave={async (regions) => {
            const res = await fetch("/api/training/marks", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ shop: props.shop, id: props.id, file: props.file, regions }),
            }).catch(() => null);
            if (!res) return "No internet. Try again.";
            if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save.";
            setSize(null);
            router.refresh();
            return null;
          }}
        />
      )}
    </>
  );
}
