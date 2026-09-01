/**
 * A drawn diagram of what a pose will produce.
 *
 * There is no cheap preview of a generative image — a preview is a generation,
 * at full price. So the pose is drawn instead: stance, where the pallu falls,
 * and how tightly the frame crops. It costs nothing, and it means a pose is
 * chosen by looking rather than by reading "Relaxed three-quarter" and guessing.
 *
 * Schematic on purpose. It is not pretending to be the render.
 */

const INK = "var(--color-ink-faint)";
const CLOTH = "var(--color-accent)";
const PALLU = "var(--color-madder)";

/** Head, torso and the saree's silhouette. Everything else varies by pose. */
function Body({ lean = 0, back = false }: { lean?: number; back?: boolean }) {
  return (
    <g transform={`translate(${lean} 0)`}>
      {/* head */}
      <circle cx="40" cy="19" r="8.5" fill="none" stroke={INK} strokeWidth="1.6" />
      {!back && (
        <>
          <circle cx="37" cy="18" r="0.9" fill={INK} />
          <circle cx="43" cy="18" r="0.9" fill={INK} />
        </>
      )}
      {back && <path d="M33 16q7 6 14 0" fill="none" stroke={INK} strokeWidth="1.3" />}

      {/* neck + blouse */}
      <path d="M40 28v4" stroke={INK} strokeWidth="1.6" />
      <path d="M31 32h18v14H31z" fill={CLOTH} opacity="0.25" stroke={INK} strokeWidth="1.2" />

      {/* the drape, waist to hem */}
      <path
        d="M31 46h18l6 60H25z"
        fill={CLOTH}
        opacity="0.18"
        stroke={INK}
        strokeWidth="1.3"
      />
      {/* pleats */}
      <path d="M34 52v52M40 50v56M46 52v52" stroke={INK} strokeWidth="0.7" opacity="0.5" />
    </g>
  );
}

function Arms({ variant }: { variant: "clasped" | "hip" | "down" | "swing" }) {
  if (variant === "clasped")
    return (
      <g fill="none" stroke={INK} strokeWidth="1.5">
        <path d="M31 34q-7 8-4 16l9 4" />
        <path d="M49 34q7 8 4 16l-9 4" />
      </g>
    );
  if (variant === "hip")
    return (
      <g fill="none" stroke={INK} strokeWidth="1.5">
        <path d="M31 34q-8 8-4 14l6 1" />
        <path d="M49 34q8 10 7 22" />
      </g>
    );
  if (variant === "swing")
    return (
      <g fill="none" stroke={INK} strokeWidth="1.5">
        <path d="M31 34q-9 9-6 20" />
        <path d="M49 34q8 7 9 17" />
      </g>
    );
  return (
    <g fill="none" stroke={INK} strokeWidth="1.5">
      <path d="M31 34q-8 10-6 24" />
      <path d="M49 34q8 10 6 24" />
    </g>
  );
}

/** The pallu is the thing that most distinguishes one pose from another. */
function Pallu({ variant }: { variant: "peak" | "front" | "behind" | "shoulder" }) {
  const stroke = { fill: PALLU, opacity: 0.55, stroke: PALLU, strokeWidth: 1 } as const;
  if (variant === "peak")
    // over the shoulder and away behind: only the point shows from the front
    return <path d="M47 32l7-6 4 8-8 5z" {...stroke} />;
  if (variant === "front")
    // down the front, full length
    return <path d="M47 32l8-4 3 8-6 66-7-2z" {...stroke} />;
  if (variant === "behind")
    // pleats falling down the back
    return <path d="M33 32l-7-3-3 8 5 60 8-2z" {...stroke} />;
  // across the chest and shoulder, for the tight crop
  return <path d="M46 31l9-5 4 9-10 26-7-3z" {...stroke} />;
}

/** The dashed rectangle showing what the camera actually keeps. */
function Crop({ y, height }: { y: number; height: number }) {
  return (
    <rect
      x="6"
      y={y}
      width="68"
      height={height}
      fill="none"
      stroke={PALLU}
      strokeWidth="1.1"
      strokeDasharray="3 3"
      rx="3"
      opacity="0.8"
    />
  );
}

export function PoseFigure({ poseId }: { poseId: string }) {
  const full = <Crop y={6} height={112} />;

  const figure = () => {
    switch (poseId) {
      case "front":
        return (
          <>
            <Body />
            <Arms variant="clasped" />
            <Pallu variant="peak" />
            {full}
          </>
        );
      case "three-quarter":
        return (
          <>
            <Body lean={-3} />
            <Arms variant="hip" />
            <Pallu variant="front" />
            {full}
          </>
        );
      case "back":
        return (
          <>
            <Body back />
            <Arms variant="down" />
            <Pallu variant="behind" />
            {full}
          </>
        );
      case "waist-up":
        // Scaled up and cropped: the whole point of this pose is the tight
        // frame, so it gets a crop box like the others rather than just
        // running off the bottom of the card.
        return (
          <>
            <g transform="translate(0 -10) scale(1.5) translate(-13 0)">
              <Body />
              <Arms variant="clasped" />
              <Pallu variant="shoulder" />
            </g>
            <Crop y={6} height={78} />
          </>
        );
      case "relaxed":
        return (
          <>
            <Body lean={-4} />
            <Arms variant="hip" />
            <Pallu variant="front" />
            {full}
          </>
        );
      case "walking":
        return (
          <>
            <Body lean={-2} />
            <Arms variant="swing" />
            <Pallu variant="front" />
            {/* a foot stepping out of the drape */}
            <path d="M46 106l6 8" stroke={INK} strokeWidth="1.5" fill="none" />
            {full}
          </>
        );
      case "seated":
        return (
          <>
            <g transform="translate(0 8)">
              <Body />
              <Arms variant="clasped" />
              <Pallu variant="front" />
            </g>
            {/* the stool */}
            <path d="M26 106h28M30 106v10M50 106v10" stroke={INK} strokeWidth="1.5" fill="none" />
            {full}
          </>
        );
      case "border-detail":
      case "pallu-detail":
        return (
          <>
            <rect x="14" y="30" width="52" height="60" rx="4" fill={CLOTH} opacity="0.16" />
            <path
              d={
                poseId === "border-detail"
                  ? "M14 74h52M14 82h52"
                  : "M20 40l40 12M20 52l40 12M20 64l40 12"
              }
              stroke={PALLU}
              strokeWidth="2.2"
              opacity="0.6"
              fill="none"
            />
            <circle cx="40" cy="52" r="17" fill="none" stroke={INK} strokeWidth="1.4" />
            <path d="M52 64l10 10" stroke={INK} strokeWidth="1.8" />
            <Crop y={24} height={72} />
          </>
        );
      default:
        return (
          <>
            <Body />
            <Arms variant="down" />
            {full}
          </>
        );
    }
  };

  return (
    <svg viewBox="0 0 80 124" aria-hidden className="h-full w-full">
      {figure()}
    </svg>
  );
}
