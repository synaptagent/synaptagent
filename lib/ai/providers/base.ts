import type { GenerateOptions, GenerateResult } from "../types";

export abstract class AIProvider {
  abstract readonly name: string;
  abstract generate(opts: GenerateOptions): Promise<GenerateResult>;
  abstract stream(opts: GenerateOptions): AsyncGenerator<string>;
}
