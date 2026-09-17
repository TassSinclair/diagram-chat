import type { ChatMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageBubbleProps {
  message: ChatMessage;
  streaming?: boolean;
}

export function MessageBubble({ message, streaming }: MessageBubbleProps) {
  return (
    <div className={`message ${message.role}`}>
      {message.role === "user" && message.images && message.images.length > 0 && (
        <div className="user-images">
          {message.images.map((src, i) => (
            <img key={i} src={src} alt={`attachment ${i + 1}`} />
          ))}
        </div>
      )}
      <MarkdownRenderer content={message.content} streaming={streaming} />
    </div>
  );
}
