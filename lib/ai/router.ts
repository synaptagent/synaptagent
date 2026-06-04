import { AccountPool } from "./account-pool";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { OpenRouterProvider } from "./providers/openrouter";
import { MODEL_MAP, type ProviderId } from "./models";
import type { AIProvider } from "./providers/base";
import type { ChatMessage, GenerateResult, UseCase } from "./types";

export interface RunOverrides {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Single entry point for all model calls. Callers pass a use case (chat, agent,
 * long_task, pro_agent), never a provider or model name. Internal routing only.
 */
export class AIRouter {
  private readonly pool = new AccountPool();
  private readonly providers: Map<ProviderId, AIProvider> = new Map();

  constructor() {
    this.providers.set("default", new OpenAICompatibleProvider(this.pool));
    this.providers.set("openrouter", new OpenRouterProvider());
  }

  async run(
    useCase: UseCase,
    messages: ChatMessage[],
    overrides: RunOverrides = {},
  ): Promise<GenerateResult> {
    const config = MODEL_MAP[useCase];
    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`AI provider "${config.provider}" is not available`);
    }

    return provider.generate({
      messages,
      model: config.model,
      maxTokens: overrides.maxTokens ?? config.maxTokens,
      temperature: overrides.temperature,
    });
  }

  async *stream(
    useCase: UseCase,
    messages: ChatMessage[],
    overrides: RunOverrides = {},
  ): AsyncGenerator<string> {
    const config = MODEL_MAP[useCase];
    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`AI provider "${config.provider}" is not available`);
    }
    yield* provider.stream({
      messages,
      model: config.model,
      maxTokens: overrides.maxTokens ?? config.maxTokens,
      temperature: overrides.temperature,
    });
  }
}

let router: AIRouter | null = null;

/** Lazily-constructed singleton so env is read at first use, not at import. */
export function getAIRouter(): AIRouter {
  if (!router) router = new AIRouter();
  return router;
}
