import OpenAI from "openai";
import { AIProvider } from "./base";
import type { GenerateOptions, GenerateResult } from "../types";
import type { AccountPool } from "../account-pool";

type ChatParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const BASE_URL = process.env.GC_BASE_URL ?? "https://api.openai.com/v1";

// Rough cost estimate per 1M tokens (input / output), used only for the account
// pool's deplete-first accounting. Tune to whatever your provider charges.
const DEFAULT_PRICE = { input: 0.3, output: 0.8 };

export class OpenAICompatibleProvider extends AIProvider {
  readonly name = "default";

  constructor(private readonly pool: AccountPool) {
    super();
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiKey = this.pool.getActiveKey();
    const client = new OpenAI({
      apiKey,
      baseURL: BASE_URL,
      timeout: 120_000, // bound a hung call (default is 10 min) so the worker never freezes
      maxRetries: 1,
    });

    try {
      const res = await client.chat.completions.create({
        model: opts.model,
        messages: opts.messages as ChatParam[],
        max_tokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.7,
        stream: false,
      });

      const inputTokens = res.usage?.prompt_tokens ?? 0;
      const outputTokens = res.usage?.completion_tokens ?? 0;
      this.pool.recordUsage(
        apiKey,
        (inputTokens * DEFAULT_PRICE.input + outputTokens * DEFAULT_PRICE.output) /
          1_000_000,
      );

      return {
        content: res.choices[0]?.message?.content ?? "",
        inputTokens,
        outputTokens,
        model: opts.model,
        provider: this.name,
      };
    } catch (err) {
      // Only a 401 means a dead key. A 429 is a transient rate limit, so do NOT
      // disable the key (that would take down every mode until a restart).
      if (err instanceof OpenAI.APIError && err.status === 401) {
        this.pool.markUnhealthy(apiKey);
      }
      throw err;
    }
  }

  async *stream(opts: GenerateOptions): AsyncGenerator<string> {
    const apiKey = this.pool.getActiveKey();
    const client = new OpenAI({
      apiKey,
      baseURL: BASE_URL,
      timeout: 120_000, // bound a hung call (default is 10 min) so the worker never freezes
      maxRetries: 1,
    });
    try {
      const completion = await client.chat.completions.create({
        model: opts.model,
        messages: opts.messages as ChatParam[],
        max_tokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.7,
        stream: true,
      });
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    } catch (err) {
      if (err instanceof OpenAI.APIError && err.status === 401) {
        this.pool.markUnhealthy(apiKey);
      }
      throw err;
    }
  }
}
