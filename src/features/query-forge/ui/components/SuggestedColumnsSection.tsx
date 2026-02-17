import React from "react";
import { EmptySectionState } from "../../../../shared/ui/EmptySectionState";
import { SectionShell } from "./SectionShell";

export type SuggestedColumn = {
  table_name: string;
  column_name: string;
  data_type?: string;
  description?: string;

  // If you already have it, we'll render it
  explanation?: string;

  confidence?: "high" | "medium" | "low";
};

type Props = {
  suggestions: SuggestedColumn[];
  selected: string[];
  onToggle: (colName: string) => void;
  onAcceptAll: () => void;
  onClearAll: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Shell plumbing (pattern match)
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide?: () => void;

  // Optional: if you want the empty CTA to do something real
  onSuggestClick?: () => void;
};

function ConfidenceBadge({ v }: { v?: "high" | "medium" | "low" }) {
  if (!v) return <span className="text-muted">—</span>;

  const label = v.charAt(0).toUpperCase() + v.slice(1);

  // Picked Bootstrap-y semantics:
  // high => green, medium => yellow, low => gray
  const cls =
    v === "high"
      ? "text-bg-success"
      : v === "medium"
      ? "text-bg-warning"
      : "text-bg-secondary";

  return (
    <span className={`badge ${cls}`} style={{ fontSize: 12 }}>
      {label}
    </span>
  );
}

export const SuggestedColumnsSection: React.FC<Props> = ({
  suggestions,
  selected,
  onToggle,
  onAcceptAll,
  onClearAll,
  collapsed,
  onToggleCollapsed,
  onHide,
  onSuggestClick,
  isFullscreen,
  onToggleFullscreen,
  
}) => {
  const has = suggestions.length > 0;
  const selectedCount = selected.length;

  return (
    <SectionShell
      id="suggested-columns"
      title="Suggested Columns"
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      iconClass="fa-magic-wand-sparkles"
      count={suggestions.length}
      onHide={onHide}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
    >
      {/* Header row BELOW title, ABOVE body (your pattern) */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="text-muted small">
          Select suggestions from the AI output.
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-light text-secondary">
            Suggested: {suggestions.length}
          </span>

          <span className="badge bg-light text-secondary">
            Selected: {selectedCount}
          </span>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onClearAll}
            disabled={suggestions.length === 0 && selected.length === 0}
            title="Clear selected columns/suggestions"
          >
            <i className="fa fa-eraser me-1" />
            Clear
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={onAcceptAll}
            disabled={suggestions.length === 0}
            title="Accept all suggested columns"
          >
            <i className="fa fa-check me-1" />
            Accept all
          </button>
        </div>
      </div>

      {!has ? (
        <EmptySectionState
          iconClass="fa-magic-wand-sparkles"
          title="No suggestions yet"
          subtitle="Run a prompt to generate suggested columns, or continue manually."
          ctaLabel="Suggest"
          onClick={() => onSuggestClick?.()}
        />
      ) : (
        <div className="table-responsive border rounded">
          <table className="table table-sm table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 44 }} />
                <th style={{ width: "22%" }}>Column</th>
                <th style={{ width: "18%" }}>Table</th>
                <th style={{ width: "32%" }}>Explanation</th>
                <th style={{ width: "18%" }}>Description</th>
                <th style={{ width: 120 }} className="text-end">
                  Confidence
                </th>
              </tr>
            </thead>

            <tbody>
              {suggestions.map((s) => {
                const key = s.column_name;
                const checked = selected.includes(key);

                return (
                  <tr key={`${s.table_name}.${s.column_name}`}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={checked}
                        onChange={() => onToggle(key)}
                      />
                    </td>

                    <td>
                      <div className="fw-semibold">{s.column_name}</div>
                      {s.data_type ? (
                        <small className="text-muted">{s.data_type}</small>
                      ) : null}
                    </td>

                    <td>
                      <code>{s.table_name}</code>
                    </td>

                    <td>
                      <small className="text-muted">
                        {(s.explanation ?? "").trim() ? s.explanation : "—"}
                      </small>
                    </td>

                    <td>
                      <small className="text-muted">
                        {(s.description ?? "").trim() ? s.description : "—"}
                      </small>
                    </td>

                    <td className="text-end">
                      <ConfidenceBadge v={s.confidence} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
};

export default SuggestedColumnsSection;