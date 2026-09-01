"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/library", label: "Library" },
];

/**
 * The portal strip.
 *
 * Solid madder, the same bar the tantu-store portal wears, so the two internal
 * tools read as one product rather than two projects that happen to share a
 * name. The public site keeps its cream header — that one is a shopfront, this
 * one is a workbench, and the strip is what tells you which you are in.
 */
export function AppHeader({ engines }: { engines: string[] }) {
  const pathname = usePathname();
  const ready = engines.length > 0;

  return (
    <header className="sticky top-0 z-40 bg-madder text-white">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-6 px-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="display text-[19px] text-white">Tantu</span>
          <span className="text-[13px] text-white/70">Try-On</span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const current = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-[14px] transition ${
                  current
                    ? "bg-white/15 font-medium text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <span
          className="ml-auto flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5"
          title={
            ready
              ? `Engine credentials found: ${engines.join(", ")}`
              : process.env.NODE_ENV === "development"
                ? "No engine credential found. Add GEMINI_API_KEY to apps/web/.env.local"
                : "No image engine is connected to this deployment, so nothing can be rendered yet."
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-good" : "bg-white/60"}`} />
          <span className="text-[13px] text-white/85">
            {ready ? `${engines.join(" · ")} connected` : "No engine key"}
          </span>
        </span>
      </div>
    </header>
  );
}
