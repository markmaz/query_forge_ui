import React, { useState } from "react";
import type { SummaryResult } from "../../hooks/useResultSummary";

const MAX_ROWS_DISPLAY = 100;

export interface ResultSummaryProps {
  summary: SummaryResult | null;
  isLoading: boolean;
  isError: boolean;
  isVisible: boolean;
  onRetry: () => void;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({
  summary,
  isLoading,
  isError,
  isVisible,
  onRetry,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      data-testid="result-summary-container"
      style={{
        display: isVisible ? undefined : "none",
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div
        data-testid="result-summary-toggle"
        className="d-flex align-items-center gap-2"
        style={{
          cursor: "pointer",
          userSelect: "none",
          padding: "6px 0",
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(0,0,0,0.75)",
        }}
        onClick={() => setIsExpanded((v) => !v)}
        role="button"
        aria-expanded={isExpanded}
      >
        <i
          className={`fa fa-chevron-${isExpanded ? "down" : "right"}`}
          style={{ fontSize: 10, marginRight: 4 }}
        />
        <span>✨</span>
        AI Summary
      </div>

      {/* Body */}
      <div
        data-testid="result-summary-content"
        style={{
          display: isExpanded ? undefined : "none",
          borderLeft: "3px solid #7c3aed",
          background: "rgba(124, 58, 237, 0.04)",
          borderRadius: "0 8px 8px 0",
          padding: "10px 14px",
          fontSize: 13,
        }}
      >
        {isLoading && (
          <div data-testid="result-summary-skeleton">
            <div className="placeholder-glow">
              <span className="placeholder col-7 mb-1 d-block" />
              <span className="placeholder col-5 mb-1 d-block" />
              <span className="placeholder col-9 mb-1 d-block" />
            </div>
          </div>
        )}

        {!isLoading && isError && (
          <div className="d-flex align-items-center gap-2 text-muted">
            <span>Summary unavailable</span>
            {isVisible && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && summary && (
          <>
            {summary.highlights.length > 0 && (
              <ul className="mb-2 ps-3" style={{ lineHeight: 1.6 }}>
                {summary.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}

            {summary.narrative && (
              <p
                data-testid="result-summary-narrative"
                className="mb-2"
                style={{ lineHeight: 1.6 }}
              >
                {summary.narrative}
              </p>
            )}

            {summary.capped && (
              <div
                className="text-muted"
                style={{ fontSize: 11, fontStyle: "italic" }}
              >
                Summary based on first {MAX_ROWS_DISPLAY.toLocaleString()} of{" "}
                {summary.totalRows.toLocaleString()} rows.
              </div>
            )}

            {summary.comparison && (
              <div
                data-testid="result-summary-comparison"
                className="mt-2 text-muted"
                style={{ fontSize: 12 }}
              >
                vs previous run: {summary.comparison}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
