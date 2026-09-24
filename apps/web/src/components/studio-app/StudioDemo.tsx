"use client";
/* eslint-disable @next/next/no-img-element -- demo shots at their own size */

import { useEffect, useState } from "react";
import { TipsModal } from "./screens";
import { T } from "./texts";

/**
 * The new studio, as a look: the splash, then the upload screen.
 *
 * Only See Tips is wired (it opens the tips carousel). Every other button is
 * there to be pressed and compared. The working studio lives at /app.
 */
export function StudioDemo() {
  const [screen, setScreen] = useState<"splash" | "upload">("splash");
  const [tips, setTips] = useState<number | null>(null);

  useEffect(() => {
    if (screen !== "splash") return;
    const timer = setTimeout(() => setScreen("upload"), 2200);
    return () => clearTimeout(timer);
  }, [screen]);

  const nothing = () => undefined;

  return (
    <div className="st">
      <div className="st-shell">
        {screen === "splash" ? (
          <div className="st-splash" onClick={() => setScreen("upload")} role="button" aria-label="Enter the studio">
            <div className="st-splash-brand">
              <TantuMark size={84} />
              <h1 className="st-splash-name">{T.splash.name}</h1>
              <p className="st-splash-tagline">{T.splash.tagline}</p>
            </div>
            <div className="st-splash-shots" aria-hidden>
              {SPLASH_SHOTS.map((src, i) => (
                <div key={i} className="st-splash-shot">
                  <img src={src} alt="" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <header className="st-header">
              <div className="st-header-main" />
              <div className="st-header-center">
                <div className="st-brand">
                  <TantuMark size={34} />
                </div>
              </div>
              <div className="st-header-actions">
                <button type="button" className="st-icon-button st-icon-button--profile" onClick={nothing} aria-label={T.profile.title}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="8" r="3.6" />
                    <path d="M5 19.5c1.4-3.4 4-5 7-5s5.6 1.6 7 5" />
                  </svg>
                </button>
              </div>
            </header>

            <main className="st-main" style={{ alignContent: "start" }}>
              <div className="st-center" style={{ gap: 6, paddingTop: 30 }}>
                <h1 className="st-title">{T.upload.title}</h1>
                <p className="st-copy">{T.upload.copy}</p>
              </div>
              <div className="st-grow" style={{ width: "100%", minHeight: "52vh" }}>
                <div className="st-callout">
                  {T.upload.calloutPrefix}{" "}
                  <button type="button" className="st-link" onClick={() => setTips(0)}>
                    {T.upload.seeTips}
                  </button>{" "}
                  {T.upload.calloutSuffix}
                </div>
                <button type="button" className="st-action" style={{ maxWidth: 360 }} onClick={nothing}>
                  {T.upload.dropzone}
                </button>
                <p className="st-support">{T.upload.dropzoneCopy}</p>
              </div>
            </main>

            <footer className="st-footer">
              <div className="st-footer-row">
                <button type="button" className="st-footer-chip st-footer-chip--balance" onClick={nothing}>
                  ₹40 left
                </button>
                <button type="button" className="st-footer-chip st-footer-chip--buy" onClick={nothing}>
                  {T.footer.buy}
                </button>
                <button type="button" className="st-footer-chip st-footer-chip--gallery" onClick={nothing}>
                  {T.myImages.title}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
      {tips !== null && <TipsModal index={tips} onIndex={setTips} onClose={() => setTips(null)} />}
    </div>
  );
}

const SPLASH_SHOTS = [
  "https://pub-344134bc87ed4d1b8a06ac24789cf1da.r2.dev/products/f0e2cc26-f9f1-4398-9989-afc99227c741/ad698475-7c31-4d4e-88d3-1da2f1f0b3e7-1790216109752.jpg",
  "https://pub-344134bc87ed4d1b8a06ac24789cf1da.r2.dev/products/f0e2cc26-f9f1-4398-9989-afc99227c741/cced55d9-4e96-4400-9572-76e028b514a9-1790216073146.jpg",
  "/splash/b_3.jpg",
  "https://pub-344134bc87ed4d1b8a06ac24789cf1da.r2.dev/products/f0e2cc26-f9f1-4398-9989-afc99227c741/5eb42d28-e31e-4515-969d-ad9946c990ed-1790216096763.jpg",
  "https://pub-344134bc87ed4d1b8a06ac24789cf1da.r2.dev/products/f0e2cc26-f9f1-4398-9989-afc99227c741/b783d2e8-630b-4b5b-b479-a326071ae91f-1790216063370.jpg",
];

function TantuMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`tantu-mark-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6a15a" />
          <stop offset="1" stopColor="#db7124" />
        </linearGradient>
      </defs>
      <path
        d="M22 30 H74 a6 6 0 0 1 0 12 H56 V64 a10 10 0 0 1 -20 0 V54 a6 6 0 0 1 12 0 v8 a2 2 0 0 0 4 0 V42 H22 a6 6 0 0 1 0 -12 Z"
        fill={`url(#tantu-mark-${size})`}
      />
      <path d="M78 12 l2.6 6.4 L87 21 l-6.4 2.6 L78 30 l-2.6 -6.4 L69 21 l6.4 -2.6 Z" fill="#f4efe6" />
    </svg>
  );
}
