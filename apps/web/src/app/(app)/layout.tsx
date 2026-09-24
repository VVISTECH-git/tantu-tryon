import { configuredProviders } from "@tantu/engine";
import { AppHeader } from "@/components/app/AppHeader";

/**
 * Rendered per request, not at build time.
 *
 * The engine-status badge reads process.env on the server. As a static page
 * that was evaluated once, at build, and baked in — so the header said "No
 * engine key" for the rest of the deployment's life no matter what was in the
 * environment. Adding the key to Vercel would have changed nothing visible,
 * which is exactly the kind of thing that costs an afternoon.
 */
export const dynamic = "force-dynamic";

/** The working half of the product: no marketing chrome, no footer, no scroll. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Anthropic reads photographs into words but generates nothing, so the engine list does not know it; the badge should. */}
      <AppHeader engines={[...configuredProviders(), ...(process.env.ANTHROPIC_API_KEY ? ["claude"] : [])]} />
      {children}
    </>
  );
}
