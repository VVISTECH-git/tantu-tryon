import { Studio } from "@/components/studio/Studio";

/**
 * Read per request, like the header's engine badge: whether this deployment
 * can read the photographs is a fact about its environment, not the build.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  return <Studio canDescribe={Boolean(process.env.GEMINI_API_KEY)} />;
}
