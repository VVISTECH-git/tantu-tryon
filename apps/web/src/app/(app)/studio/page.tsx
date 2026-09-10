import { Studio } from "@/components/studio/Studio";

/**
 * Read per request, like the header's engine badge: whether this deployment
 * can read the photographs is a fact about its environment, not the build.
 * Any of the three keys the describe route accepts will do.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  const canDescribe = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
  );
  return <Studio canDescribe={canDescribe} />;
}
