"use client";

import { useEffect, useState } from "react";
import { ConfirmButton } from "@/components/ui";

/** The link to send people: product IDs and photos, no sign-in. */
export function ShareLink() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/platform/share", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ token?: string; error?: string }>)
      .then((b) => (b.token ? setToken(b.token) : setProblem(b.error ?? "Could not read the link.")))
      .catch(() => setProblem("Could not read the link."));
  }, []);

  const link = token ? `${window.location.origin}/share/${token}` : "";

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-[13px]">
      <p className="font-semibold">Share these photos</p>
      <p className="mt-1 text-ink-soft">Anyone with this link sees the product IDs and their photos (no tag photos), without signing in.</p>
      {token && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12.5px]" />
          <button
            type="button"
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-white"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <a href={link} target="_blank" rel="noreferrer" className="text-accent underline">Open</a>
          <ConfirmButton
            label="New link"
            confirmLabel="Tap again: the old link stops working"
            onConfirm={() => {
              void fetch("/api/platform/share", { method: "POST" })
                .then((r) => r.json() as Promise<{ token?: string }>)
                .then((b) => b.token && setToken(b.token));
            }}
          />
        </div>
      )}
      {problem && <p className="mt-2 text-danger">{problem}</p>}
    </div>
  );
}
