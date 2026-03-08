import React, { useMemo } from "react";
import { EmptySectionState } from "../../../../shared/components/EmptySectionState";
import { SectionShell } from "./SectionShell";

export type SuggestedColumn = {
  table_name: string;
  column_name: string;
  data_type?: string;
  description?: string;
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
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide?: () => void;
  onSuggestClick?: () => void;
};

function ConfidenceBadge({ level }: { level?: SuggestedColumn["confidence"] }) {
  if (!level) return <span className="text-muted">—</span>;

  const palette =
    level === "high"
      ? "text-bg-success"
      : level === "medium"
      ? "text-bg-warning"
      : "text-bg-secondary";

  return (
    <span className={`badge ${palette}`} style={{ fontSize: 12 }}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function SuggestionsToolbar({
  suggestedCount,
  selectedCount,
  onClear,
  onAcceptAll,
  disableClear,
  disableAccept,
}: {
  suggestedCount: number;
  selectedCount: number;
  onClear: () => void;
  onAcceptAll: () => void;
  disableClear: boolean;
  disableAccept: boolean;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between mb-2">
      <div className="text-muted small">Select suggestions from the AI output.</div>

      <div className="d-flex align-items-center gap-2">
        <span className="badge bg-light text-secondary">Suggested: {suggestedCount}</span>
        <span className="badge bg-light text-secondary">Selected: {selectedCount}</span>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={onClear}
          disabled={disableClear}
          title="Clear selected columns/suggestions"
        >
          <i className="fa fa-eraser me-1" />
          Clear
        </button>

        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={onAcceptAll}
          disabled={disableAccept}
          title="Accept all suggested columns"
        >
          <i className="fa fa-check me-1" />
          Accept all
        </button>
      </div>
    </div>
  );
}

function ColumnSuggestionRow({
  suggestion,
  selected,
  onToggle,
}: {
  suggestion: SuggestedColumn;
  selected: boolean;
  onToggle: (columnName: string) => void;
}) {
  return (
    <tr>
      <td onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          className="form-check-input"
          checked={selected}
          onChange={() => onToggle(suggestion.column_name)}
        />
      </td>

      <td>
        <div className="fw-semibold">{suggestion.column_name}</div>
        {suggestion.data_type ? <small className="text-muted">{suggestion.data_type}</small> : null}
      </td>

      <td>
        <code>{suggestion.table_name}</code>
      </td>

      <td>
        <small className="text-muted">
          {suggestion.explanation?.trim() ? suggestion.explanation : "—"}
        </small>
      </td>

      <td>
        <small className="text-muted">
          {suggestion.description?.trim() ? suggestion.description : "—"}
        </small>
      </td>

      <td className="text-end">
        <ConfidenceBadge level={suggestion.confidence} />
      </td>
    </tr>
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
  const hasSuggestions = suggestions.length > 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

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
      <SuggestionsToolbar
        suggestedCount={suggestions.length}
        selectedCount={selected.length}
        onClear={onClearAll}
        onAcceptAll={onAcceptAll}
        disableClear={suggestions.length === 0 && selected.length === 0}
        disableAccept={suggestions.length === 0}
      />

      {!hasSuggestions ? (
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
              {suggestions.map((suggestion) => (
                <ColumnSuggestionRow
                  key={`${suggestion.table_name}.${suggestion.column_name}`}
                  suggestion={suggestion}
                  selected={selectedSet.has(suggestion.column_name)}
                  onToggle={onToggle}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
};

export default SuggestedColumnsSection;
