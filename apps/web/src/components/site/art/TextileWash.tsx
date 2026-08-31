/**
 * A whisper of block print behind a hero. Deliberately near-invisible — it is
 * there to stop a large field of cream reading as blank paper, not to be looked
 * at. It fades out downward so nothing competes with the type.
 */
export function TextileWash({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <svg className="h-full w-full" preserveAspectRatio="xMidYMin slice">
        <defs>
          <pattern id="tw-butta" width="56" height="56" patternUnits="userSpaceOnUse">
            <g fill="var(--color-madder)">
              {Array.from({ length: 6 }, (_, index) => (
                <ellipse
                  key={index}
                  cx={28}
                  cy={20}
                  rx={2.1}
                  ry={7.4}
                  transform={`rotate(${index * 30} 28 28)`}
                />
              ))}
              <circle cx={28} cy={28} r={2.6} />
              <circle cx={0} cy={0} r={1.6} />
              <circle cx={56} cy={56} r={1.6} />
            </g>
          </pattern>
          <linearGradient id="tw-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="55%" stopColor="white" stopOpacity="0.14" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="tw-mask">
            <rect width="100%" height="100%" fill="url(#tw-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#tw-butta)" mask="url(#tw-mask)" opacity="0.07" />
      </svg>
    </div>
  );
}
