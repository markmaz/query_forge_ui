import React from "react";
import "../styles/no-code.css"

export type WorkspaceToolKey = "savedQueries";

export type SectionKey =
  | "prompt"
  | "suggested"
  | "domain"
  | "columns"
  | "filters"
  | "aggs"
  | "preview"
  | "sorting";

export function WorkspaceToolRail(props: {
  activeTool?: WorkspaceToolKey | null;
  onToggleSavedQueries: () => void;

  visibleSections: Record<SectionKey, boolean>;
  onShowSection: (k: SectionKey) => void;

  // ✅ NEW: which hidden button should pulse (typically the one just minimized)
  pulseKeys?: Partial<Record<SectionKey, boolean>>;

  className?: string;
}) {
  const {
    activeTool,
    onToggleSavedQueries,
    visibleSections,
    onShowSection,
    pulseKeys,
    className,
  } = props;

  const savedQueriesPressed = activeTool === "savedQueries";

  const SECTION_BUTTONS: Array<{ key: SectionKey; label: string; iconClass: string }> = [
    { key: "prompt", label: "Prompt", iconClass: "fa-lightbulb" },
    { key: "suggested", label: "Suggested Columns", iconClass: "fa-magic-wand-sparkles" },
    { key: "domain", label: "Domain", iconClass: "fa-layer-group" },
    { key: "columns", label: "Columns", iconClass: "fa-table-columns" },
    { key: "filters", label: "Filters", iconClass: "fa-filter" },
    { key: "aggs", label: "Aggregations", iconClass: "fa-chart-simple" },
    { key: "sorting", label: "Sorting", iconClass: "fa-sort" },
    { key: "preview", label: "Preview", iconClass: "fa-eye" },
    
  ];

  const hiddenSectionButtons = SECTION_BUTTONS.filter((b) => !visibleSections[b.key]);

  return (
    <div
      className={
        "bg-light h-100 d-flex flex-column align-items-center flex-shrink-0 " +
        (className ?? "")
      }
      style={{
        width: 44,
        padding: 0,
        margin: 0,
        borderRight: "0.5px solid rgba(0,0,0,0.06)",
        borderRadius: 0,
        transform: "translateX(-10px)",
      }}
      aria-label="Workspace tools"
    >
      {/* ✅ ALWAYS VISIBLE: Saved Queries */}
      <div style={{ marginTop: 6 }}>
        <RailButton
          pressed={savedQueriesPressed}
          iconClass="fa-save"
          label="Saved Queries"
          onClick={onToggleSavedQueries}
        />
      </div>

      {/* spacer between tools + hidden sections */}
      <div style={{ height: 12 }} />

      {/* ✅ Only show section icons when hidden */}
      {hiddenSectionButtons.length > 0 ? (
        <div className="d-flex flex-column align-items-center" style={{ gap: 10 }}>
          {hiddenSectionButtons.map((b) => (
            <RailButton
              key={b.key}
              pressed={false}
              iconClass={b.iconClass}
              label={`Show ${b.label}`}
              onClick={() => onShowSection(b.key)}
              // ✅ pulse ONLY if the page says so
              pulse={!!pulseKeys?.[b.key]}
            />
          ))}
        </div>
      ) : null}

      <div className="flex-grow-1" />

      {/* local CSS so this is truly "drop-in" */}
      {/* <style>{`
        @keyframes nqRailPulseOnce {
          0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0.06); background: rgba(0,0,0,0.00); }
          45%  { box-shadow: 0 0 0 6px rgba(0,0,0,0.03); background: rgba(0,0,0,0.03); }
          100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.00); background: rgba(0,0,0,0.00); }
        }
        .nq-rail-pulse {
          animation: nqRailPulseOnce 520ms ease-out 1;
        }
      `}</style> */}
    </div>
  );
}

function RailButton(props: {
  pressed: boolean;
  iconClass: string;
  label: string;
  onClick: () => void;
  pulse?: boolean;
}) {
  const { pressed, iconClass, label, onClick, pulse } = props;

  return (
    <button
      type="button"
      className={
        "btn d-flex align-items-center justify-content-center " +
        (pulse ? "nq-rail-pulse" : "")
      }
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      style={{
        width: 44,
        height: 38,
        padding: 0,
        border: "none",
        borderRadius: 0,
        background: pressed ? "rgba(0,0,0,0.06)" : "transparent",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (pressed) return;
        e.currentTarget.style.background = "rgba(0,0,0,0.045)";
      }}
      onMouseLeave={(e) => {
        if (pressed) return;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <i className={"fa " + iconClass} aria-hidden="true" style={{ fontSize: 16, opacity: 0.85 }} />
    </button>
  );
}
