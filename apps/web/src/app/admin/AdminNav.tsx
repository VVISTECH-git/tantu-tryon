"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * One bar across every admin page (28 Sep): each admin page reachable from
 * every other, instead of only from the Platform page's links.
 */
export function AdminNav({ platform, owner }: { platform: boolean; owner: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/app", label: "Studio" },
    ...(platform
      ? [
          { href: "/admin/spend", label: "Platform" },
          { href: "/admin/products", label: "Products" },
          { href: "/admin/generations", label: "Generations" },
          { href: "/admin/storage", label: "Storage" },
        ]
      : []),
    ...(owner ? [{ href: "/admin/shop", label: "Shop" }] : []),
  ];
  return (
    <nav className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-1 px-6 py-2 text-[13.5px]">
        <span className="mr-2 font-semibold tracking-tight">Tantu admin</span>
        {links.map((l) => {
          const here = l.href !== "/app" && path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={here ? "page" : undefined}
              className={`rounded-full px-3 py-1 ${here ? "bg-accent/15 font-semibold text-accent" : "text-ink-soft hover:text-ink"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
