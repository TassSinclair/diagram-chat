import type { Metrics } from "../types";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <div className="metrics-panel">
      <div className="metric">
        <span className="metric-label">Cost:</span>
        <span className="metric-value">{formatCost(metrics.totalCostUsd)}</span>
      </div>
      <div className="metric">
        <span className="metric-label">In:</span>
        <span className="metric-value">
          {formatTokens(metrics.inputTokens)}
        </span>
      </div>
      <div className="metric">
        <span className="metric-label">Out:</span>
        <span className="metric-value">
          {formatTokens(metrics.outputTokens)}
        </span>
      </div>
      {metrics.ttftMs > 0 && (
        <div className="metric">
          <span className="metric-label">TTFT:</span>
          <span className="metric-value">
            {formatDuration(metrics.ttftMs)}
          </span>
        </div>
      )}
      <div className="metric">
        <span className="metric-label">Duration:</span>
        <span className="metric-value">
          {formatDuration(metrics.durationMs)}
        </span>
      </div>
      {Object.keys(metrics.modelUsage || {}).length > 0 && (
        <div className="metric">
          <span className="metric-label">Models:</span>
          <span className="metric-value">
            {Object.keys(metrics.modelUsage).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
