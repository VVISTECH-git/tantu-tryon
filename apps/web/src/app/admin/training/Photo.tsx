"use client";

import { useState } from "react";

/** A training photo that shows "Still uploading" in its place until it is in the bucket, never a broken image. */
export function Photo(props: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!props.src || failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 text-center text-[12px] text-ink-faint ${props.className ?? ""}`}>
        Photo still uploading
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={props.src} alt={props.alt} loading="lazy" onError={() => setFailed(true)} className={props.className} />;
}
