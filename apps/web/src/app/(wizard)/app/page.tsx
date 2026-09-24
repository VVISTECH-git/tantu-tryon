import { SignIn } from "@/components/studio-app/SignIn";
import { StudioApp } from "@/components/studio-app/StudioApp";
import { canDescribe } from "@/lib/describe";
import { currentAccount } from "@/lib/session";
import { balancePaise } from "@/lib/spend";

export const dynamic = "force-dynamic";

/** One URL. Signed out it is the door; signed in it is the whole studio. */
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Without a database this deployment can only show the door; the studio
  // itself needs DATABASE_URL, and says so in the server log rather than 500ing.
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.warn("[app] DATABASE_URL is not set; the studio cannot sign anyone in.");
    return <SignIn next="/app" />;
  }
  const account = await currentAccount();
  if (!account) {
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    return <SignIn next={safeNext} />;
  }
  return (
    <StudioApp
      account={{ id: account.id, name: account.name, kind: account.kind }}
      balancePaise={await balancePaise(account.id)}
      canDescribe={canDescribe()}
    />
  );
}
