export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: number;
}

export interface Metrics {
  totalCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  ttftMs: number;
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      costUSD: number;
    }
  >;
}

export interface Conversation {
  messages: ChatMessage[];
  metrics: Metrics | null;
  model: string | null;
}
