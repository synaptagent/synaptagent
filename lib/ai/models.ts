import type { UseCase } from "./types";

export type ProviderId = "default" | "openrouter";

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  maxTokens: number;
}

// Internal use-case -> model assignment. Model ids come from env so a tier can be
// re-pointed without a code change. Users never see these values.
export const MODEL_MAP: Record<UseCase, ModelConfig> = {
  // Layer 1: live chat (fast, cheap)
  chat: {
    provider: "default",
    model: process.env.GC_MODEL_CHAT ?? "gpt-4o-mini",
    maxTokens: 2000,
  },
  // Layer 2: async agent work (reasoning)
  agent: {
    provider: "default",
    model: process.env.GC_MODEL_AGENT ?? "gpt-4o-mini",
    maxTokens: 4000,
  },
  // Layer 2: multi-day deep tasks (long context)
  long_task: {
    provider: "default",
    model: process.env.GC_MODEL_LONG ?? "gpt-4o",
    maxTokens: 8000,
  },
  // Pro tier upgrade, routed via OpenRouter.
  pro_agent: {
    provider: "openrouter",
    model: process.env.OPENROUTER_MODEL_PRO ?? "openai/gpt-4o",
    maxTokens: 8000,
  },
};
