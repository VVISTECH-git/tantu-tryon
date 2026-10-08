"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Good / Not good for one made image: the generation's own verdict. Tap again to clear. */
export function ReviewButtons({ id, verdict: initial }: { id: string; verdict: "approved" | "rejected" | null }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function set(next: "approved" | "rejected") {
    const value = verdict === next ? null : next;
    setBusy(true);
    const res = await fetch(`/api/generations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ verdict: value }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setVerdict(value);
      router.refresh();
    }
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
      <button
        type="button"
        disabled={busy}
        onClick={() => void set("approved")}
        className={`rounded-lg border px-3 py-2 font-semibold ${verdict === "approved" ? "border-good bg-good text-white" : "border-line hover:border-good"}`}
      >
        Good
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void set("rejected")}
        className={`rounded-lg border px-3 py-2 font-semibold ${verdict === "rejected" ? "border-danger bg-danger text-white" : "border-line hover:border-danger"}`}
      >
        Not good
      </button>
    </div>
  );
}
