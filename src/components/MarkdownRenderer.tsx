import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";
import { MermaidBlock } from "./MermaidBlock";
import { D2Block } from "./D2Block";

function makeComponents(streaming: boolean): Partial<Components> {
  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const lang = match?.[1];
      const code = String(children).replace(/\n$/, "");

      if (lang === "mermaid" && !streaming) {
        return <MermaidBlock code={code} />;
      }

      if (lang === "d2" && !streaming) {
        return <D2Block code={code} />;
      }

      if (lang) {
        return (
          <pre>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
  };
}

type Segment =
  | { type: "text"; content: string }
  | { type: "svg"; content: string };

const SVG_RE = /<svg[\s>][\s\S]*?<\/svg>/gi;

function splitSvgSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(SVG_RE)) {
    const before = content.slice(lastIndex, match.index);
    if (before) segments.push({ type: "text", content: before });
    segments.push({ type: "svg", content: match[0] });
    lastIndex = match.index! + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail) segments.push({ type: "text", content: tail });
  return segments;
}

export function MarkdownRenderer({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const components = useMemo(
    () => makeComponents(!!streaming),
    [streaming]
  );

  const segments = useMemo(() => splitSvgSegments(content), [content]);
  const hasSvg = segments.some((s) => s.type === "svg");

  if (!hasSvg) {
    return (
      <div className={`markdown-body${streaming ? " streaming-cursor" : ""}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={`markdown-body${streaming ? " streaming-cursor" : ""}`}>
      {segments.map((seg, i) =>
        seg.type === "svg" ? (
          <div
            key={i}
            className="svg-container"
            dangerouslySetInnerHTML={{ __html: seg.content }}
          />
        ) : (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={components}
          >
            {seg.content}
          </ReactMarkdown>
        )
      )}
    </div>
  );
}
