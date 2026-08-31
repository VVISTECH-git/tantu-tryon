import type { Metadata } from "next";
import { TOOLS } from "@/content/tools";

export const metadata: Metadata = {
  title: "AI Tools",
  description: "Everything Tantu does, and honestly what it does not do yet.",
};

export default function ToolsPage() {
  const live = TOOLS.filter((tool) => tool.status === "live");
  const planned = TOOLS.filter((tool) => tool.status === "planned");

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16">
      <p className="label mb-3">AI Tools</p>
      <h1 className="display max-w-3xl text-[38px] leading-tight sm:text-[46px]">
        Everything it does — and what it does not do yet.
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
        Anything marked <em>planned</em> is not built. It is listed because you should be able to
        see where this is going, not because it is available today.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>

      <h2 className="display mt-16 text-[26px]">Planned</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {planned.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: (typeof TOOLS)[number] }) {
  return (
    <a
      href={`/tools/${tool.slug}`}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-7 transition hover:border-accent"
    >
      <div className="flex items-center gap-2">
        <span className="label">{tool.kicker}</span>
        {tool.status === "planned" && (
          <span className="rounded-full bg-turmeric-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-turmeric">
            planned
          </span>
        )}
      </div>
      <h3 className="display mt-2 text-[22px] group-hover:text-accent">{tool.name}</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{tool.summary}</p>
      <span className="mt-5 text-[14px] text-accent">Read more →</span>
    </a>
  );
}
