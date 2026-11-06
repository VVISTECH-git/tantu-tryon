import type { ReactNode } from "react";
import { currentAccount } from "@/lib/session";
import { SignOut } from "./SignOut";

/**
 * 6 Nov 2026: the site is one page (product ID and photos), so the admin bar
 * is just the name and Sign out. The full menu is in the archive
 * (git tag archive-full-site-2026-11-06).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const account = await currentAccount().catch(() => null);
  return (
    <>
      {account && (
        <nav className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3 text-[13.5px]">
            <span className="font-semibold tracking-tight">Tantu · Products</span>
            <SignOut />
          </div>
        </nav>
      )}
      {children}
    </>
  );
}
