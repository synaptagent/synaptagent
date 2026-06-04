import OpenAI from "openai";
import { AIProvider } from "./base";
import type { GenerateOptions, GenerateResult } from "../types";

type ChatParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const BASE_URL = "https://openrouter.ai/api/v1";

// Aggregator used for models not available on the primary provider (e.g. the
// pro-tier model). Single key, lazily constructed so a missing key never breaks
// boot, only an actual pro-tier call.
export class OpenRouterProvider extends AIProvider {
  readonly name = "openrouter";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
      this.client = new OpenAI({
        apiKey,
        baseURL: BASE_URL,
        timeout: 120_000,
        maxRetries: 1,
      });
    }
    return this.client;
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const res = await this.getClient().chat.completions.create({
      model: opts.model,
      messages: opts.messages as ChatParam[],
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.7,
      stream: false,
    });

    return {
      content: res.choices[0]?.message?.content ?? "",
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      model: opts.model,
      provider: this.name,
    };
  }

  async *stream(opts: GenerateOptions): AsyncGenerator<string> {
    const completion = await this.getClient().chat.completions.create({
      model: opts.model,
      messages: opts.messages as ChatParam[],
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    });
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}
