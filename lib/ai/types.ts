export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  /** Internal model id. Never surface this to end users. */
  model: string;
  /** Internal provider id. Never surface this to end users. */
  provider: string;
}

/** Use cases map to internal models. The UI refers to these, never to models. */
export type UseCase = "chat" | "agent" | "long_task" | "pro_agent";
