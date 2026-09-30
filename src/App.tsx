import { useState, useRef, useCallback, useEffect } from "react";
import type { Conversation, ChatMessage } from "./types";
import { MessageBubble } from "./components/MessageBubble";
import { MetricsPanel } from "./components/MetricsPanel";
import { ChatInput } from "./components/ChatInput";

export function App() {
  const [conversation, setConversation] = useState<Conversation>({
    messages: [],
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
          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    metrics: {
                      inputTokens: usage.input_tokens || 0,
                      outputTokens: usage.output_tokens || 0,
                      thinkingTokens: usage.thinking_tokens || 0,
                    },
                  }
                : m
            ),
          }));
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
            <div key={msg.id}>
              <MessageBubble
                message={msg}
                streaming={
                  streaming &&
                  msg.role === "assistant" &&
                  i === conversation.messages.length - 1
                }
              />
              {msg.metrics && (
                <MetricsPanel metrics={msg.metrics} />
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        <div className="empty-state">
          <h2>Diagram Chat</h2>
          <p>
            Supports Markdown, Mermaid diagrams, D2 diagrams, reladraw diagrams, and images.
          </p>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}

const SYSTEM_PROMPT = `

You can produce diagrams using Mermaid, D2 or reladraw syntax inside fenced code blocks.
When you include a \`\`\`mermaid, \`\`\`d2 or \`\`\`reladraw code block in your response, it will be automatically rendered as a visual diagram for the user.
Do not instruct the user on how to render the diagram — it happens automatically.

When returning a diagram in SVG, Mermaid, D2 or reladraw format, do NOT include ANY explanation.

When rendering a diagram, be careful to ensure the syntax is valid. Avoid empty labels.
When rendering a SVG, Mermaid, D2 or reladraw diagram, just draw the diagram and then stop. DO NOT explain unless the user requests additional information.
You also support standard Markdown formatting in your responses.

## reladraw syntax

reladraw is a text language for diagrams where you say where things go. The file states the arrangement — \`right of api\`, \`between web and worker\`, \`level with queue\` — and the tool works out only the distances. Nothing is auto-laid-out.

### Nodes
\`\`\`
node <name> ["<text>"] [<placement>] [<attributes>]
\`\`\`
Leave text out and the node takes its name. \` / \` in text is a line break. Containment via dotted names (parent declared first):
\`\`\`
node server "Server"
node server.api "API"
node server.worker "Worker"
\`\`\`

### Placement
\`above\`, \`below\`, \`left of\`, \`right of\`, \`level with\`, diagonals (\`above-left of\`). A lone directional binds both axes. Multiple placements allowed. \`gap: none | tight | normal | wide\`.

### Edges
\`\`\`
edge <from> -> <to> ["<text>"] [from: side] [to: side]
\`\`\`
\`<-\` and \`<->\` also work. \`from:\`/\`to:\` name a side: \`top\`, \`bottom\`, \`left\`, \`right\`. Routing: \`between a and b\`, \`below c\`, \`above c\`.

### Styles & colors
\`\`\`
style store  fill: theme-primary-subtle  border: theme-primary  badge: database
node db "DB"  style: store
\`\`\`
Prefer theme colors: \`theme-primary\`, \`theme-secondary\`, \`theme-primary-subtle\`, \`theme-muted\`, \`theme-page\`, \`theme-text\`, \`theme-fill\`, \`theme-border\`, \`theme-line\`.

### Shapes & icons
Shapes: \`rectangle\` (default), \`document\`, \`circle\`, \`none\` (annotation).
Icons (draws node AS the icon): \`disk\`, \`desktop\`, \`laptop\`, \`package\`, \`cubes\`, \`cube\`, \`database\`.
\`badge: <icon>\` puts the icon beside the text.

### Annotations
\`\`\`
node aside "Some note text" (wrap: 30)  shape: none  below target
\`\`\`
Always give annotations a \`(wrap: n)\`.

### Line styling
\`line: (path: curved|square|straight, corners: sharp|rounded, pattern: solid|dashed|dotted, thickness: thin|normal|thick, crossing: gap|none|arc)\`

### Common mistakes to avoid
- There is no \`note\`, \`box\` or \`link\` keyword. Only \`node\` and \`edge\`.
- \`#\` is not a comment — use \`//\`.
- No braces, semicolons, \`-->\`, or subgraphs.
- Every pair of nodes must be ordered (no overlaps). If two children hang off the same side, place one against the other.
- Annotations without \`(wrap: n)\` produce a single very long line.

### Example
\`\`\`reladraw
style store  fill: theme-primary-subtle  border: theme-primary  badge: database

node browser "Browser"
node api "API server"  right of browser
node db "Postgres"  right of api  style: store
node worker "Worker"  below api

edge browser -> api "HTTP"  from: right  to: left
edge api -> db "SQL"  from: right  to: left
edge worker -> db "writes"  from: right  to: bottom
\`\`\`
`;

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
