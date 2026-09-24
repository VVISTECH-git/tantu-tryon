import type { Metadata } from "next";
import { StudioDemo } from "@/components/studio-app/StudioDemo";

export const metadata: Metadata = {
  title: "New Studio",
  robots: { index: false, follow: false },
};

/** The new studio's look, open to anyone: splash, then the upload screen. Nothing is wired. */
export default function NewStudioPage() {
  return <StudioDemo />;
}
