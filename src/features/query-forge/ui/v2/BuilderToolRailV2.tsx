import React from "react";

export type ToolKeyV2 = "domain" | "columns" | "dataprep" | "filters" | "aggs" | "sorting";

type ToolItem = { key: ToolKeyV2; label: string; iconClass: string };

const TOOLS: ToolItem[] = [
  { key: "domain", label: "Domain", iconClass: "fa-layer-group" },
  { key: "columns", label: "Columns", iconClass: "fa-table-columns" },
  { key: "dataprep", label: "Data Prep", iconClass: "fa-soap" },
  { key: "filters", label: "Filters", iconClass: "fa-filter" },
  { key: "aggs", label: "Aggs", iconClass: "fa-chart-simple" },
  { key: "sorting", label: "Sorting", iconClass: "fa-sort" },
];

export function BuilderToolRailV2(props: {
  openTool: ToolKeyV2 | null;
  onToggle: (k: ToolKeyV2) => void;
  onSave: () => void;
  onToggleSavedQueries?: () => void;
  savedQueriesOpen?: boolean;
}) {
  const { openTool, onToggle, onSave, onToggleSavedQueries, savedQueriesOpen } = props;

  return (
    <div className="ncqv2-builder-rail" aria-label="Builder tools">
      <div className="ncqv2-rail-top">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onSave}
          aria-label="Save query"
          title="Save query"
        >
          <i className="fa fa-save" aria-hidden="true" />
        </button>

        {onToggleSavedQueries ? (
          <button
            type="button"
            className={`btn btn-sm ${savedQueriesOpen ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={onToggleSavedQueries}
            aria-pressed={Boolean(savedQueriesOpen)}
            aria-label="Saved queries"
            title="Saved queries"
          >
            <i className="fa fa-folder-open" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="ncqv2-rail-divider" />

      {TOOLS.map((tool) => {
        const isActive = openTool === tool.key;
        return (
          <button
            key={tool.key}
            type="button"
            className={`btn btn-sm ${isActive ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => onToggle(tool.key)}
            aria-pressed={isActive}
            aria-label={tool.label}
            title={tool.label}
          >
            <i className={`fa ${tool.iconClass}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
