"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarkEditor } from "../labels/MarkEditor";

/** Mark the parts on a product photo nobody marked yet (a "whole saree" photo, say), from nothing. */
export function MarkPhoto(props: { garmentId: string; slot: string; src: string; width: number; height: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="underline">
        mark parts
      </button>
      {open && (
        <MarkEditor
          title={props.slot}
          src={props.src}
          width={props.width}
          height={props.height}
          regions={[]}
          onClose={() => setOpen(false)}
          onSave={async (regions) => {
            const res = await fetch(`/api/garments/${props.garmentId}/marks`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ slot: props.slot, regions }),
            }).catch(() => null);
            if (!res) return "No internet. Try again.";
            if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save.";
            setOpen(false);
            router.refresh();
            return null;
          }}
        />
      )}
    </>
  );
}
