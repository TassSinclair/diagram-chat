import { useState, useRef, useCallback, useEffect } from "react";
import type { Conversation, ChatMessage, Metrics } from "./types";
import { MessageBubble } from "./components/MessageBubble";
import { MetricsPanel } from "./components/MetricsPanel";
import { ChatInput } from "./components/ChatInput";

export function App() {
  const [conversation, setConversation] = useState<Conversation>({
    messages: [],
    metrics: null,
    model: null,
  });
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string, imageFiles: File[]) => {
      const imagePreviews: string[] = [];
      for (const file of imageFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        imagePreviews.push(dataUrl);
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        images: imagePreviews.length > 0 ? imagePreviews : undefined,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
      }));
      setStreaming(true);

      try {
        const history = buildMessages(conversation.messages, userMessage);
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            try {
              const event = JSON.parse(json);
              handleSSEEvent(event, assistantMessage.id);
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err) {
        setConversation((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content:
                    m.content +
                    `\n\n*Error: ${err instanceof Error ? err.message : "Connection failed"}*`,
                }
              : m
          ),
        }));
      } finally {
        setStreaming(false);
      }
    },
    [conversation.messages]
  );

  const handleSSEEvent = useCallback(
    (event: Record<string, unknown>, assistantId: string) => {
      switch (event.type) {
        case "session":
          setConversation((prev) => ({
            ...prev,
            model: (event.model as string) || prev.model,
          }));
          break;

        case "text":
          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + (event.text as string) }
                : m
            ),
          }));
          break;

        case "metrics": {
          const usage = (event.usage || {}) as Record<string, number>;
          const metrics: Metrics = {
            totalCostUsd: (event.totalCostUsd as number) || 0,
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            durationMs: (event.durationMs as number) || 0,
            ttftMs: (event.ttftMs as number) || 0,
            modelUsage:
              (event.modelUsage as Metrics["modelUsage"]) || {},
          };
          setConversation((prev) => ({ ...prev, metrics }));
          break;
        }

        case "error":
          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content + `\n\n*Error: ${event.error}*`,
                  }
                : m
            ),
          }));
          break;
      }
    },
    []
  );

  const hasMessages = conversation.messages.length > 0;

  return (
    <div className="app">
      <div className="header">
        <h1>Diagram Chat</h1>
        {conversation.model && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {conversation.model}
          </span>
        )}
      </div>

      {hasMessages ? (
        <div className="messages">
          {conversation.messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              streaming={
                streaming &&
                msg.role === "assistant" &&
                i === conversation.messages.length - 1
              }
            />
          ))}
          {conversation.metrics && !streaming && (
            <MetricsPanel metrics={conversation.metrics} />
          )}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        <div className="empty-state">
          <h2>Diagram Chat</h2>
          <p>
            Supports Markdown, Mermaid diagrams, D2 diagrams, and images.
          </p>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}

const SYSTEM_PROMPT = `

You can produce diagrams using Mermaid or D2 syntax inside fenced code blocks. 
When you include a \`\`\`mermaid or \`\`\`d2 code block in your response, it will be automatically rendered as a visual diagram for the user. 
Do not instruct the user on how to render the diagram — it happens automatically.

You can also produce diagrams using SVG code by returning the SVG directly, it will render on the user's client.

When rendering a diagram, be careful to ensure the syntax is valid. Avoid empty labels.
When rendering a SVG, Mermaid or D2 diagram, just draw the diagram and then stop. DO NOT explain unless the user requests additional information.
You also support standard Markdown formatting in your responses.`;

function buildMessages(existing: ChatMessage[], newMessage: ChatMessage) {
  const history = [...existing, newMessage]
    .filter((m) => m.content.trim() !== "")
    .map((m) => {
      if (m.images && m.images.length > 0) {
        return {
          role: m.role,
          content: [
            ...m.images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: img },
            })),
            { type: "text" as const, text: m.content },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
  return [{ role: "system", content: SYSTEM_PROMPT }, ...history];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
