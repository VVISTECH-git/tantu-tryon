import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/session";
import type { Account } from "@/db";

/** For a page: the account, or off to the sign-in screen and back here after. */
export async function requirePage(next: string): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect(`/app?next=${encodeURIComponent(next)}`);
  return account;
}
