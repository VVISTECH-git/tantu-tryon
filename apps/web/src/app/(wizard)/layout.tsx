import type { Metadata } from "next";
import "@/components/studio-app/studio.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tantu Studio",
  description: "Transform garment photos into premium model catalog shoots in seconds.",
  robots: { index: false, follow: false },
};

/**
 * The studio's frame is the shell itself (`StudioApp`), header and footer
 * included, so this layout only brings the stylesheet and gets out of the way.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
