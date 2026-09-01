import { configuredProviders } from "@tantu/engine";
import { AppHeader } from "@/components/app/AppHeader";

/** The working half of the product: no marketing chrome, no footer, no scroll. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader engines={configuredProviders()} />
      {children}
    </>
  );
}
