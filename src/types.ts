export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: number;
  metrics?: Metrics;
}

export interface Metrics {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
}

export interface Conversation {
  messages: ChatMessage[];
  model: string | null;
}
