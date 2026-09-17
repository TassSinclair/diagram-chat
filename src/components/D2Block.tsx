import { useEffect, useRef, useState } from "react";
import { D2 } from "@d2lang/d2";

let d2Instance: D2 | null = null;

function getD2(): D2 {
  if (!d2Instance) {
    d2Instance = new D2();
  }
  return d2Instance;
}

export function D2Block({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const d2 = getD2();
    d2.compile({
      fs: { "index.d2": code },
      inputPath: "index.d2",
      options: { layout: "tala" },
    })
      .then((result) => d2.render(result.diagram, result.renderOptions))
      .then((svg) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "D2 rendering failed");
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return <div className="d2-container">Rendering D2 diagram...</div>;
  }

  if (error) {
    return (
      <div className="d2-error">
        D2 error: {error}
        <pre>{code}</pre>
      </div>
    );
  }

  return <div ref={ref} className="d2-container" />;
}
