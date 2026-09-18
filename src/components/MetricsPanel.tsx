import type { Metrics } from "../types";

export function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <div className="metrics-panel">
      <div className="metric">
        <span className="metric-label">In:</span>
        <span className="metric-value">
          {metrics.inputTokens.toLocaleString()}
        </span>
      </div>
      <div className="metric">
        <span className="metric-label">Out:</span>
        <span className="metric-value">
          {metrics.outputTokens.toLocaleString()}
        </span>
      </div>
      {metrics.thinkingTokens > 0 && (
        <div className="metric">
          <span className="metric-label">Thinking:</span>
          <span className="metric-value">
            {metrics.thinkingTokens.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
