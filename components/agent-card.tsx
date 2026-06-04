import Link from "next/link";
import { formatCount, nsLabel, type Agent } from "@/lib/agents-mock";

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.8 4.2 13.8l.7-4.3-3.1-3 4.3-.6z"
      />
    </svg>
  );
}
function ForkIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 3.5a1.5 1.5 0 10-2 1.4V7a2 2 0 002 2h2v2.1a1.5 1.5 0 101 0V9h2a2 2 0 002-2V4.9a1.5 1.5 0 10-1 0V7a1 1 0 01-1 1H5a1 1 0 01-1-1V4.9c.3-.1.6-.4.8-.7z"
      />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 3C4.5 3 1.7 5.1.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5C14.3 5.1 11.5 3 8 3zm0 8a3 3 0 110-6 3 3 0 010 6zm0-4.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
      />
    </svg>
  );
}

export function AgentCard({ a }: { a: Agent }) {
  return (
    <Link
      href={`/agent/${a.ns.replace(/^@/, "")}/${a.name}`}
      className="group flex flex-col rounded-lg border border-cream/15 bg-background-pure p-5 transition-colors hover:border-orange-500/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[15px] text-cream transition-colors group-hover:text-orange-500">
            <span className="text-cream/45">{nsLabel(a.ns)}/</span>
            <span className="font-semibold break-all">{a.name}</span>
          </div>
          {a.forkedFrom ? (
            <p className="mt-1 flex items-center font-mono text-[11px] text-cream/45">
              <ForkIcon />{" "}
              <span className="ml-1 truncate">forked from {a.forkedFrom}</span>
            </p>
          ) : a.ns === "synaptagent" ? (
            <p className="mt-1 font-mono text-[11px] text-cream/35">
              public template
            </p>
          ) : (
            <p className="mt-1 font-mono text-[11px] text-cream/35">
              community agent
            </p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
          </span>
          live
        </span>
      </div>

      <p className="mt-3 min-h-[40px] text-sm leading-relaxed text-cream/65">
        {a.desc || (
          <span className="text-cream/30">no description yet.</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.topics.map((t) => (
          <span
            key={t}
            className="rounded-full bg-cream/[0.06] px-2.5 py-0.5 font-mono text-[11px] text-cream/55"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-5 font-mono text-[12px] text-cream/45">
        <span className="flex items-center gap-1.5">
          <span style={{ color: a.kindColor }}>●</span>
          {a.kind}
        </span>
        <span className="flex items-center gap-1 text-cream/65">
          <StarIcon /> {formatCount(a.stars)}
        </span>
        <span className="flex items-center gap-1 text-cream/65">
          <ForkIcon /> {formatCount(a.forks)}
        </span>
        <span className="flex items-center gap-1">
          <EyeIcon /> {formatCount(a.views)}
        </span>
      </div>
    </Link>
  );
}
