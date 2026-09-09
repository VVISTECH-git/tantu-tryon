"use client";

import { useState } from "react";

/**
 * The hand-off to Gemini, in one press.
 *
 * A page cannot reach into another site's chat box, so this does the most a
 * page can: it puts the sheet and the prompt on the clipboard together, as
 * one item with an image part and a text part, and opens Gemini. Chrome
 * hands both parts to the paste target; Gemini attaches the image and
 * inserts the text from a single Ctrl+V. Send is the person's.
 *
 * The clipboard write needs a user gesture and a focused document, and the
 * new tab takes focus the moment it opens — so the write goes first and the
 * tab second, and the sheet has to be in memory already for the write to be
 * quick enough. The caller prefetches it.
 */
export function GeminiButton({
  prompt,
  sheet,
  className = "",
}: {
  prompt: string;
  /** The sheet PNG, already fetched. Null while it is still on its way. */
  sheet: Blob | null;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "text-only" | "failed">("idle");

  async function go() {
    let next: typeof state = "done";
    try {
      const text = new Blob([prompt], { type: "text/plain" });
      if (sheet && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "text/plain": text, "image/png": sheet })]);
        } catch {
          // Some browsers refuse an image on the clipboard. The text still goes.
          await navigator.clipboard.writeText(prompt);
          next = "text-only";
        }
      } else {
        await navigator.clipboard.writeText(prompt);
        next = "text-only";
      }
    } catch {
      next = "failed";
    }
    setState(next);
    if (next !== "failed") window.open("https://gemini.google.com/app", "_blank", "noopener");
    setTimeout(() => setState("idle"), 4000);
  }

  const label =
    state === "done"
      ? "Copied both — paste in Gemini"
      : state === "text-only"
        ? "Prompt copied — attach the sheet by hand"
        : state === "failed"
          ? "Clipboard refused — use Copy"
          : sheet
            ? "Open Gemini"
            : "Open Gemini (preparing sheet…)";

  return (
    <button
      type="button"
      onClick={() => void go()}
      disabled={!prompt}
      title="Puts the sheet and this prompt on your clipboard, then opens Gemini. Press Ctrl+V there, then send."
      className={`rounded-lg px-4 py-2 text-[14px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        state === "done" || state === "text-only"
          ? "bg-ink text-white"
          : "bg-accent text-white hover:bg-accent-hover"
      } ${className}`}
    >
      {label}
    </button>
  );
}
