"use client";

import { useState } from "react";

/**
 * Copy, and say so.
 *
 * A copy button that looks identical before and after leaves you pressing it
 * twice to be sure. The label changes for a moment, which is the whole of the
 * feedback anybody needs.
 */
export function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      // Clipboard refused — a private window, or no permission. The text is
      // on screen and selectable, so this is a convenience, not the only way.
      setDone(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
        done
          ? "border-accent bg-accent text-white"
          : "border-line text-ink-soft hover:border-ink-faint hover:text-ink"
      } ${className}`}
    >
      {done ? "Copied" : label}
    </button>
  );
}
