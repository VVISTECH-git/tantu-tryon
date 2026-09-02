import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lab } from "@/components/lab/Lab";
import { poseSpec } from "@/registry/poses";

/**
 * The pose under test is fixed on purpose. With the pose held constant,
 * anything wrong in the output is the garment pipeline.
 */
const POSE_UNDER_TEST = "SAR-P15";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tantu Lab",
  // Internal R&D. It should never appear in a search result.
  robots: { index: false, follow: false, nocache: true },
};

export default async function LabPage() {
  const pose = poseSpec(POSE_UNDER_TEST);
  if (!pose) notFound();

  return <Lab pose={pose} />;
}
