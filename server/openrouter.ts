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

  const startTime = Date.now();

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
      let ttft: number | null = null;

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
            }

            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              if (ttft === null) ttft = Date.now() - startTime;
              res.write(
                `data: ${JSON.stringify({ type: "text", text: delta.content })}\n\n`
              );
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      const durationMs = Date.now() - startTime;
      const inputCostPer1M = 0.15;
      const outputCostPer1M = 0.60;
      const totalCostUsd =
        (inputTokens * inputCostPer1M + outputTokens * outputCostPer1M) /
        1_000_000;

      res.write(
        `data: ${JSON.stringify({
          type: "metrics",
          totalCostUsd,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          },
          durationMs,
          ttftMs: ttft || 0,
          modelUsage: {
            [model]: {
              inputTokens,
              outputTokens,
              costUSD: totalCostUsd,
            },
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
