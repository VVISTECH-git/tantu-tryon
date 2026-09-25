import { useId } from "react";
import { TANTU_MARK_GRADIENT, TANTU_MARK_PATHS, TANTU_MARK_VIEWBOX } from "@tantu/shared/brand";

/** Tantu's mark: the script T in the studio's orange (packages/shared/src/brand.ts). */
export function TantuMark({ size, className }: { size?: number; className?: string }) {
  const id = `tantu-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg className={className} width={size} height={size} viewBox={TANTU_MARK_VIEWBOX} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={TANTU_MARK_GRADIENT[0]} />
          <stop offset="1" stopColor={TANTU_MARK_GRADIENT[1]} />
        </linearGradient>
      </defs>
      {TANTU_MARK_PATHS.map((d, i) => (
        <path key={i} d={d} fill={`url(#${id})`} />
      ))}
    </svg>
  );
}
