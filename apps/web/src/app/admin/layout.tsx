import type { ReactNode } from "react";
import { currentAccount } from "@/lib/session";
import { canReviewLabels } from "@/lib/partLabels";
import { AdminNav } from "./AdminNav";

/** Every admin page gets the same bar on top; each page still checks who may see it. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const account = await currentAccount().catch(() => null);
  return (
    <>
      {account && <AdminNav platform={account.platformAdmin} owner={account.role === "owner"} labels={canReviewLabels(account)} />}
      {children}
    </>
  );
}
