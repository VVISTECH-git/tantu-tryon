"use client";

import { useEffect, useRef, useState } from "react";
import { TOOLS } from "@/content/tools";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

export function SiteHeader() {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) setToolsOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setToolsOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-[1280px] items-center gap-8 px-6 py-4">
        <a href="/" className="flex items-baseline gap-2">
          <span className="display text-[26px] text-madder">Tantu</span>
          <span className="text-[13px] text-ink-soft">Try-On</span>
        </a>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((open) => !open)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[15px] text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            >
              AI Tools
              <span className={`text-[10px] transition ${toolsOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {toolsOpen && (
              <div className="absolute left-0 top-full mt-2 w-[560px] rounded-2xl border border-line bg-surface p-3 shadow-lg shadow-ink/5">
                <div className="grid grid-cols-2 gap-1">
                  {TOOLS.map((tool) => (
                    <a
                      key={tool.slug}
                      href={`/tools/${tool.slug}`}
                      onClick={() => setToolsOpen(false)}
                      className="rounded-xl px-3 py-2.5 transition hover:bg-surface-2"
                    >
                      <span className="flex items-center gap-2 text-[14px] font-medium">
                        {tool.name}
                        {tool.status === "planned" && (
                          <span className="rounded-full bg-turmeric-wash px-2 py-0.5 text-[10px] font-medium tracking-wide text-turmeric uppercase">
                            planned
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">
                        {tool.kicker}
                      </span>
                    </a>
                  ))}
                </div>
                <a
                  href="/tools"
                  onClick={() => setToolsOpen(false)}
                  className="mt-2 block rounded-xl border-t border-line-soft px-3 pt-3 text-[13px] text-accent hover:underline"
                >
                  See all tools →
                </a>
              </div>
            )}
          </div>

          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-[15px] text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="/studio"
          className="ml-auto hidden rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-accent-hover lg:ml-0 lg:block"
        >
          Open the Studio
        </a>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="ml-auto rounded-full border border-line px-4 py-2 text-[15px] lg:hidden"
        >
          Menu
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-line bg-surface px-6 py-4 lg:hidden">
          <a href="/tools" className="block py-2.5 text-[16px] font-medium">
            AI Tools
          </a>
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="block py-2.5 text-[16px] text-ink-soft">
              {link.label}
            </a>
          ))}
          <a
            href="/studio"
            className="mt-3 block rounded-full bg-accent px-5 py-3 text-center text-[16px] font-medium text-white"
          >
            Open the Studio
          </a>
        </div>
      )}
    </header>
  );
}
