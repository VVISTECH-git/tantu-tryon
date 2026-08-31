import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageSlot, type Tone } from "@/components/site/art/Ornament";
import { TOOLS, toolBySlug } from "@/content/tools";

const TONES: Tone[] = ["madder", "indigo", "turmeric", "cream"];

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) return {};
  return { title: tool.name, description: tool.summary };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();

  const others = TOOLS.filter((other) => other.slug !== tool.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16">
      <Link href="/tools" className="text-[14px] text-ink-faint hover:text-ink">
        ← All tools
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span className="label">{tool.kicker}</span>
        {tool.status === "planned" && (
          <span className="rounded-full bg-turmeric-wash px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-turmeric">
            planned — not built yet
          </span>
        )}
      </div>

      <h1 className="display mt-3 max-w-3xl text-[38px] leading-tight sm:text-[48px]">
        {tool.name}
      </h1>
      <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-ink-soft">{tool.summary}</p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <p className="text-[17px] leading-relaxed">{tool.body}</p>

          <div className="rounded-2xl border border-turmeric/30 bg-turmeric-wash p-6">
            <p className="label !text-turmeric">What it will not do</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">{tool.caveat}</p>
          </div>

          {tool.status === "live" && (
            <Link
              href="/studio"
              className="inline-block rounded-full bg-accent px-6 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover"
            >
              Try it in the Studio →
            </Link>
          )}
        </div>

        <div className="space-y-6">
          <div className="h-56 overflow-hidden rounded-2xl">
            <ImageSlot
              tone={TONES[TOOLS.findIndex((other) => other.slug === tool.slug) % TONES.length]!}
              seed={TOOLS.findIndex((other) => other.slug === tool.slug)}
              vine
              ratio={16 / 9}
            />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-7">
            <p className="label mb-3">You give it</p>
            <ul className="space-y-2.5">
              {tool.takes.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
                  <span className="text-madder">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-7">
            <p className="label mb-3">You get back</p>
            <ul className="space-y-2.5">
              {tool.gives.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
                  <span className="text-madder">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <h2 className="display mt-20 text-[26px]">The rest of it</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {others.map((other) => (
          <Link
            key={other.slug}
            href={`/tools/${other.slug}`}
            className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-accent"
          >
            <span className="label">{other.kicker}</span>
            <h3 className="display mt-1.5 text-[19px] group-hover:text-accent">{other.name}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
