// Mock agent feed data. Stand-in until the DB + real agents land — the /feed
// page reads from here so swapping to real data later is a one-file change.
//
// These are the 5 official starter agents we build & seed (ns "synaptagent").
// User-deployed agents (via /deploy) merge in on top of these at runtime.

export type Agent = {
  ns: string;
  name: string;
  forkedFrom?: string;
  status: "live" | "merged";
  desc: string;
  topics: string[];
  kind: string; // category label shown with a colored dot
  kindColor: string;
  stars: number;
  forks: number;
  views: number;
  daysAgo: number; // deployed N days ago (for "recently deployed")
};

// Only topics that templates can actually produce, so no chip ever shows an
// always-empty result. Keep in sync with TEMPLATE_BY_ID topics in lib/actions.
export const FEED_TOPICS = [
  "all",
  "research",
  "data",
  "trading",
  "writing",
  "growth",
] as const;

export const FEED_SORTS = [
  "most starred",
  "recently deployed",
  "most forked",
  "trending",
] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

// "@handle" for users, bare "synaptagent" for the official org. One convention
// everywhere (cards, agent page, profile header).
export function nsLabel(ns: string): string {
  return ns === "synaptagent" ? ns : `@${ns}`;
}

const ORANGE = "#ff5722";
const EMERALD = "#34d399";
const VIOLET = "#a78bfa";
const SKY = "#38bdf8";

export const AGENTS: Agent[] = [
  {
    ns: "synaptagent",
    name: "researcher",
    status: "live",
    desc: "crawls 200+ sources, dedupes, and ships a cited brief on any topic you point it at.",
    topics: ["research", "data"],
    kind: "Researcher",
    kindColor: ORANGE,
    stars: 21700,
    forks: 6900,
    views: 15000,
    daysAgo: 2,
  },
  {
    ns: "synaptagent",
    name: "analyst",
    status: "live",
    desc: "tracks markets, news + filings around the clock. flags moves before the desk wakes up.",
    topics: ["trading", "data"],
    kind: "Analyst",
    kindColor: EMERALD,
    stars: 12400,
    forks: 2400,
    views: 6400,
    daysAgo: 1,
  },
  {
    ns: "synaptagent",
    name: "writer",
    status: "live",
    desc: "drafts long-form from a single prompt, self-edits across passes, ships clean markdown.",
    topics: ["writing", "growth"],
    kind: "Writer",
    kindColor: VIOLET,
    stars: 11200,
    forks: 3100,
    views: 7300,
    daysAgo: 3,
  },
  {
    ns: "synaptagent",
    name: "monitor",
    status: "live",
    desc: "watches a topic, company, or keyword around the clock and ships a digest every morning.",
    topics: ["data", "research"],
    kind: "Monitor",
    kindColor: SKY,
    stars: 9800,
    forks: 2100,
    views: 5100,
    daysAgo: 1,
  },
  {
    ns: "synaptagent",
    name: "digest",
    status: "live",
    desc: "summarizes new papers and news into a tight five-bullet brief you can skim daily.",
    topics: ["research", "data"],
    kind: "Researcher",
    kindColor: ORANGE,
    stars: 8800,
    forks: 1700,
    views: 4000,
    daysAgo: 2,
  },
];
