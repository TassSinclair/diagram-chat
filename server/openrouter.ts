import type { Response } from "express";

interface ChatMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export function streamOpenRouter(
  messages: ChatMessage[],
  res: Response
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4.1-flash";

  if (!apiKey || apiKey === "your-key-here") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(
      `data: ${JSON.stringify({ type: "error", error: "OPENROUTER_API_KEY not configured in .env" })}\n\n`
    );
    res.write(`data: ${JSON.stringify({ type: "done", code: 1 })}\n\n`);
    res.end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(
    `data: ${JSON.stringify({ type: "session", model })}\n\n`
  );

  fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "Diagram Chat",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        res.write(
          `data: ${JSON.stringify({ type: "error", error: `OpenRouter ${response.status}: ${text}` })}\n\n`
        );
        res.write(`data: ${JSON.stringify({ type: "done", code: 1 })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let thinkingTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);

            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
              thinkingTokens =
                chunk.usage.completion_tokens_details?.reasoning_tokens || 0;
            }

            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              res.write(
                `data: ${JSON.stringify({ type: "text", text: delta.content })}\n\n`
              );
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      res.write(
        `data: ${JSON.stringify({
          type: "metrics",
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            thinking_tokens: thinkingTokens,
          },
        })}\n\n`
      );

      res.write(`data: ${JSON.stringify({ type: "done", code: 0 })}\n\n`);
      res.end();
    })
    .catch((err) => {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`
      );
      res.write(`data: ${JSON.stringify({ type: "done", code: 1 })}\n\n`);
      res.end();
    });

  res.on("close", () => {
    // client disconnected — nothing to clean up since fetch doesn't expose an abort here
  });
}
