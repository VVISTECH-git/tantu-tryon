import Link from "next/link";
import { configuredProviders } from "@tantu/engine";

/** The working half of the product: no marketing chrome, no footer, no scroll. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const engines = configuredProviders();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-ground/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-6 px-6">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="display text-[22px] text-madder">Tantu</span>
            <span className="text-[14px] text-ink-soft">Try-On</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            <Link
              href="/studio"
              className="rounded-full px-4 py-2 text-[14px] font-medium text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            >
              Studio
            </Link>
            <Link
              href="/library"
              className="rounded-full px-4 py-2 text-[14px] font-medium text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            >
              Library
            </Link>
          </nav>

          <span
            className="ml-auto flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5"
            title={
              engines.length
                ? `Engine credentials found: ${engines.join(", ")}`
                : "No engine credential found. Add GEMINI_API_KEY to apps/web/.env.local"
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${engines.length ? "bg-good" : "bg-danger"}`}
            />
            <span className="label">{engines.length ? engines.join(" · ") : "no key"}</span>
          </span>
        </div>
      </header>

      {children}
    </>
  );
}
