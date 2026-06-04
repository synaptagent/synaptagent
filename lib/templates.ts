// Canonical agent templates. Keys match the Prisma `Template` enum.
// `icon` is a lucide id, mapped to a component in the UI layer.
// These are the 5 official agents we build & seed, plus a blank (CUSTOM) start.

export type TemplateKey =
  | "RESEARCHER"
  | "ANALYST"
  | "WRITER"
  | "MONITOR"
  | "DIGEST"
  | "CUSTOM";

export interface TemplateDef {
  key: TemplateKey;
  name: string;
  icon: string;
  description: string;
  /** System prompt that defines the agent's behavior. */
  personality: string;
  capabilities: string[];
  bestFor: string;
}

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  RESEARCHER: {
    key: "RESEARCHER",
    name: "Researcher",
    icon: "search",
    description:
      "crawls 200+ sources, dedupes, and ships a cited brief on any topic you point it at.",
    personality:
      "You are a research agent. Investigate topics thoroughly, find primary sources, and synthesize findings into clear, cited summaries. Be skeptical of low-quality content. Default to specific over generic. No em-dashes.",
    capabilities: ["web_search", "summarize", "extract_data", "cite_sources"],
    bestFor: "researchers, analysts, journalists",
  },
  ANALYST: {
    key: "ANALYST",
    name: "Analyst",
    icon: "chart",
    description:
      "tracks markets, news, and filings around the clock and flags moves before the desk wakes up.",
    personality:
      "You are an analysis agent for markets and companies. Track signals, news, and filings, identify trends, and flag what matters early. Be data-driven, never speculative. State confidence levels. No em-dashes.",
    capabilities: ["web_search", "track_signals", "summarize"],
    bestFor: "traders, analysts, operators",
  },
  WRITER: {
    key: "WRITER",
    name: "Writer",
    icon: "pen",
    description:
      "drafts long-form from a single prompt and self-edits across passes into clean markdown.",
    personality:
      "You are a writing agent. Match the user's voice and style precisely. Draft long-form, then self-edit across passes for clarity and punch. Concrete over abstract. Short sentences. No AI-sounding filler. No em-dashes.",
    capabilities: ["writing", "research", "self_edit"],
    bestFor: "creators, founders, marketers",
  },
  MONITOR: {
    key: "MONITOR",
    name: "Monitor",
    icon: "eye",
    description:
      "watches a topic, company, or keyword around the clock and ships a digest every morning.",
    personality:
      "You are a monitoring agent. Watch the assigned topic, company, or keyword continuously, detect what changed, and ship a concise digest on schedule. Surface only what is new and relevant. No em-dashes.",
    capabilities: ["web_search", "track_changes", "schedule", "digest"],
    bestFor: "founders, operators, analysts",
  },
  DIGEST: {
    key: "DIGEST",
    name: "Digest",
    icon: "newspaper",
    description:
      "narrows a firehose of papers and news into a tight five-bullet brief you can skim daily.",
    personality:
      "You are a digest agent. Take a firehose of papers and news, rank by relevance, and compress into a tight, skimmable brief. Every bullet earns its place. No em-dashes.",
    capabilities: ["web_search", "summarize", "rank", "digest"],
    bestFor: "researchers, busy readers",
  },
  CUSTOM: {
    key: "CUSTOM",
    name: "Custom",
    icon: "sliders",
    description:
      "build from scratch. choose your own capabilities and personality.",
    personality: "",
    capabilities: [],
    bestFor: "power users",
  },
};

export const TEMPLATE_LIST: TemplateDef[] = Object.values(TEMPLATES);

// Per-template display: the category label + dot color shown on agent cards.
// Single source of truth so seeded agents and user-deployed agents match.
export const TEMPLATE_DISPLAY: Record<TemplateKey, { label: string; color: string }> = {
  RESEARCHER: { label: "Researcher", color: "#ff5722" },
  ANALYST: { label: "Analyst", color: "#34d399" },
  WRITER: { label: "Writer", color: "#a78bfa" },
  MONITOR: { label: "Monitor", color: "#38bdf8" },
  DIGEST: { label: "Digest", color: "#fbbf24" },
  CUSTOM: { label: "Custom", color: "#9b958a" },
};
