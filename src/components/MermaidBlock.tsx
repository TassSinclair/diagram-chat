import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaidInitialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "default",
    securityLevel: "loose",
  });
}

let counter = 0;

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initMermaid();
    const id = `mermaid-${++counter}`;

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to render diagram");
      });
  }, [code]);

  if (error) {
    return (
      <div className="d2-error">
        Mermaid error: {error}
        <pre>{code}</pre>
      </div>
    );
  }

  return (
    <div className="mermaid-container">
      <div ref={ref} />
      <div hidden data-diagram-source="mermaid">{code}</div>
    </div>
  );
}
