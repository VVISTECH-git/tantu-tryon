import Link from "next/link";
import { TOOLS } from "@/content/tools";

const COLUMNS = [
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact Us" },
      { href: "/pricing", label: "Pricing" },
      { href: "/gallery", label: "Gallery" },
    ],
  },
  {
    heading: "Product",
    links: [
      { href: "/studio", label: "Open the Studio" },
      { href: "/tools", label: "All tools" },
      { href: "/library", label: "Your library" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="display text-[24px] text-madder">Tantu</span>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-ink-soft">
            Model-worn catalogue imagery from photographs of the real garment. Built for Indian
            ethnic wear, where the motif is the product.
          </p>
        </div>

        <div>
          <p className="label mb-3">AI Tools</p>
          <ul className="space-y-2">
            {TOOLS.filter((tool) => tool.status === "live").map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="text-[14px] text-ink-soft transition hover:text-ink"
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="label mb-3">{column.heading}</p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[14px] text-ink-soft transition hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line-soft">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6">
          <p className="text-[13px] text-ink-faint">
            © {new Date().getFullYear()} VVIS Tech. Tantu is a VVIS Tech product.
          </p>
          <p className="text-[13px] text-ink-faint sm:ml-auto">
            Images you upload stay yours. We do not train anything on them.
          </p>
        </div>
      </div>
    </footer>
  );
}
