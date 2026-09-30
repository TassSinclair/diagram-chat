import { useMemo, useState } from "react";
import { compile, DARK_THEME, THEMES } from "reladraw";
import type { Theme } from "reladraw";

function getTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK_THEME
    : THEMES["light"] ?? DARK_THEME;
}

export function ReladrawBlock({ code }: { code: string }) {
  const [theme] = useState(getTheme);

  const result = useMemo(() => {
    try {
      const svg = compile(code, { theme });
      return { svg, error: null };
    } catch (err) {
      return {
        svg: null,
        error: err instanceof Error ? err.message : "reladraw rendering failed",
      };
    }
  }, [code, theme]);

  if (result.error) {
    return (
      <div className="d2-error">
        reladraw error: {result.error}
        <pre>{code}</pre>
      </div>
    );
  }

  return (
    <div className="reladraw-container">
      <div dangerouslySetInnerHTML={{ __html: result.svg! }} />
      <div hidden data-diagram-source="reladraw">
        {code}
      </div>
    </div>
  );
}
