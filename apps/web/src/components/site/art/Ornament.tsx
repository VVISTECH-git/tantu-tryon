/**
 * Drawn ornament, standing in until real renders exist.
 *
 * These are not pretending to be photographs of a saree — they are block-print
 * fields: rosette buttas on a dyed ground, a temple border along the edge, a
 * vine running through it. That is honest, it is the right visual language for
 * the product, and every panel is one `src` prop away from becoming a real
 * photograph without the layout changing.
 */

export type Tone = "madder" | "indigo" | "turmeric" | "cream";

interface Palette {
  ground: string;
  ink: string;
  accent: string;
}

const TONES: Record<Tone, Palette> = {
  madder: { ground: "#9c3327", ink: "#f2e2c9", accent: "#e0a14b" },
  indigo: { ground: "#24405c", ink: "#e8ddc6", accent: "#c9a227" },
  turmeric: { ground: "#c98a2e", ink: "#3d2410", accent: "#8f2f22" },
  cream: { ground: "#f0e5d0", ink: "#9c3327", accent: "#24405c" },
};

/** Eight-petal butta — the unit a block-printed field repeats. */
function Rosette({ size, color, opacity = 1 }: { size: number; color: string; opacity?: number }) {
  const petals = 8;
  return (
    <g opacity={opacity}>
      {Array.from({ length: petals }, (_, index) => (
        <ellipse
          key={index}
          cx={0}
          cy={-size * 0.3}
          rx={size * 0.105}
          ry={size * 0.3}
          transform={`rotate(${(360 / petals) * index})`}
          fill={color}
        />
      ))}
      <circle r={size * 0.13} fill={color} />
    </g>
  );
}

/** A smaller four-point filler, so the field is not a plain grid of one shape. */
function Filler({ size, color, opacity = 1 }: { size: number; color: string; opacity?: number }) {
  const arm = size * 0.42;
  return (
    <path
      d={`M0,${-arm} Q${size * 0.08},0 0,${arm} Q${-size * 0.08},0 0,${-arm} Z
          M${-arm},0 Q0,${-size * 0.08} ${arm},0 Q0,${size * 0.08} ${-arm},0 Z`}
      fill={color}
      opacity={opacity}
    />
  );
}

/** Temple border — the row of arches that runs along a saree's edge. */
export function TempleBorder({
  width,
  height,
  color,
  accent,
  flip = false,
}: {
  width: number;
  height: number;
  color: string;
  accent: string;
  flip?: boolean;
}) {
  const step = 26;
  const count = Math.ceil(width / step) + 1;

  return (
    <g transform={flip ? `translate(0 ${height}) scale(1 -1)` : undefined}>
      <rect x={0} y={0} width={width} height={height} fill={color} />
      {Array.from({ length: count }, (_, index) => {
        const x = index * step;
        return (
          <g key={index}>
            <path
              d={`M${x},${height} L${x + step / 2},${height - height * 0.62} L${x + step},${height} Z`}
              fill={accent}
            />
            <circle cx={x + step / 2} cy={height - height * 0.72} r={height * 0.09} fill={accent} />
          </g>
        );
      })}
    </g>
  );
}

/** A creeping vine, the thing hand-painted work fills open ground with. */
function Vine({
  width,
  height,
  color,
  opacity = 1,
}: {
  width: number;
  height: number;
  color: string;
  opacity?: number;
}) {
  const mid = width / 2;
  const amp = width * 0.17;
  const path = `M${mid},${height} C${mid + amp},${height * 0.82} ${mid - amp},${height * 0.66} ${mid},${height * 0.5} C${mid + amp},${height * 0.34} ${mid - amp},${height * 0.18} ${mid},${height * 0.04}`;

  const leaves = Array.from({ length: 9 }, (_, index) => {
    const t = 0.06 + index * 0.1;
    const y = height * (1 - t);
    const side = index % 2 === 0 ? 1 : -1;
    const x = mid + Math.sin(t * Math.PI * 3) * amp * 0.85;
    return { x, y, side, index };
  });

  return (
    <g opacity={opacity}>
      <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      {leaves.map((leaf) => (
        <g key={leaf.index} transform={`translate(${leaf.x} ${leaf.y})`}>
          <ellipse
            cx={leaf.side * 13}
            cy={0}
            rx={13}
            ry={5.5}
            fill={color}
            transform={`rotate(${leaf.side * -22} ${leaf.side * 13} 0)`}
          />
          <circle cx={leaf.side * 27} cy={leaf.side * -5} r={3.2} fill={color} />
        </g>
      ))}
    </g>
  );
}

/**
 * A panel of printed cloth. `seed` shifts the field so no two read alike.
 */
export function FabricPanel({
  tone = "madder",
  seed = 0,
  vine = false,
  className,
  ratio = 4 / 5,
}: {
  tone?: Tone;
  seed?: number;
  vine?: boolean;
  className?: string;
  ratio?: number;
}) {
  const palette = TONES[tone];
  const width = 400;
  const height = Math.round(width / ratio);
  const border = Math.round(height * 0.085);

  const step = 74;
  const rows = Math.ceil((height - border * 2) / step) + 1;
  const cols = Math.ceil(width / step) + 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={className}
    >
      <rect width={width} height={height} fill={palette.ground} />

      {/* the field of buttas */}
      <g>
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const offset = (row + seed) % 2 === 0 ? 0 : step / 2;
            const x = col * step + offset - step / 4;
            const y = border + row * step + step / 2;
            if (y > height - border) return null;
            const isFiller = (row + col + seed) % 3 === 0;
            return (
              <g key={`${row}-${col}`} transform={`translate(${x} ${y})`}>
                {isFiller ? (
                  <Filler size={30} color={palette.accent} opacity={0.75} />
                ) : (
                  <Rosette size={40} color={palette.ink} opacity={0.85} />
                )}
              </g>
            );
          }),
        )}
      </g>

      {vine && <Vine width={width} height={height} color={palette.ink} opacity={0.5} />}

      {/* borders top and bottom */}
      <TempleBorder width={width} height={border} color={palette.ink} accent={palette.ground} flip />
      <g transform={`translate(0 ${height - border})`}>
        <TempleBorder width={width} height={border} color={palette.ink} accent={palette.ground} />
      </g>
    </svg>
  );
}

/**
 * A horizontal rule of temple arches, for between sections. Uses the page's own
 * ink so it sits quietly rather than shouting.
 */
export function BorderRule({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 18"
      preserveAspectRatio="none"
      aria-hidden
      className={className}
      role="presentation"
    >
      <TempleBorder width={1200} height={18} color="transparent" accent="var(--color-madder)" />
    </svg>
  );
}

/**
 * An image, or the drawn stand-in for one. Swapping ornament for photography
 * later is a `src` prop, not a layout change.
 */
export function ImageSlot({
  src,
  alt,
  tone = "madder",
  seed = 0,
  vine,
  className = "",
  ratio,
}: {
  src?: string;
  alt?: string;
  tone?: Tone;
  seed?: number;
  vine?: boolean;
  className?: string;
  ratio?: number;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ""} className={`h-full w-full object-cover ${className}`} />;
  }
  return <FabricPanel tone={tone} seed={seed} vine={vine} ratio={ratio} className={`h-full w-full ${className}`} />;
}
