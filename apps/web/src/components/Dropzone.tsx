"use client";

import { useRef, useState } from "react";
import { formatBytes, loadImageFile, type LoadedImage } from "@/lib/image";

export interface DropzoneProps {
  label: string;
  hint?: string;
  value?: { dataUrl: string; bytes: number; width: number; height: number };
  onPick: (image: LoadedImage) => void;
  onClear?: () => void;
  /** A slot this garment really wants filled, marked so the eye goes there. */
  recommended?: boolean;
  required?: boolean;
  compact?: boolean;
}

export function Dropzone({
  label,
  hint,
  value,
  onPick,
  onClear,
  recommended,
  required,
  compact,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPick(await loadImageFile(file));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  const border = over
    ? "border-accent bg-accent-wash"
    : value
      ? "border-line bg-surface"
      : required
        ? "border-dashed border-danger/45 bg-surface hover:border-danger"
        : recommended
          ? "border-dashed border-madder/35 bg-surface hover:border-madder"
          : "border-dashed border-line bg-surface hover:border-ink-faint";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void accept(event.dataTransfer.files[0]);
        }}
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl border text-left transition ${
          compact ? "aspect-square" : "aspect-4/5"
        } ${border}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.dataUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
            <span className="text-[20px] leading-none text-ink-faint">{busy ? "···" : "+"}</span>
            <span className="text-[13px] font-medium leading-tight text-ink-soft">{label}</span>
            {required && <span className="label !text-danger">required</span>}
            {!required && recommended && <span className="label !text-madder">recommended</span>}
          </span>
        )}

        {value && (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8">
            <span className="truncate text-[13px] font-medium text-white">{label}</span>
            {!compact && (
              <span className="ml-auto text-[11px] text-white/75">
                {value.width}×{value.height} · {formatBytes(value.bytes)}
              </span>
            )}
          </span>
        )}
      </button>

      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${label}`}
          className="absolute right-2 top-2 hidden h-7 w-7 place-items-center rounded-full bg-white/95 text-[15px] leading-none text-ink-soft shadow-sm transition hover:text-danger group-hover:grid"
        >
          ×
        </button>
      )}

      {hint && !value && <p className="mt-2 text-[12px] leading-snug text-ink-faint">{hint}</p>}
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
