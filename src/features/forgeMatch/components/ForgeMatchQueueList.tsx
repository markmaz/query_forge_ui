import ForgeMatchConfidencePill from "./ForgeMatchConfidencePill";
import ForgeMatchStatusBadge from "./ForgeMatchStatusBadge";
import type { ForgeMatchMapping } from "../types";

type Props = {
  rows: ForgeMatchMapping[];
  selectedMappingId: string | null;
  onSelect: (mappingId: string) => void;
};

function bestMatchLabel(row: ForgeMatchMapping): string {
  if (!row.best_match) return "No match";
  const table = row.best_match.table_name ?? "";
  const column = row.best_match.column_name ?? "";
  return `${table}.${column}`.replace(/^\./, "") || "No match";
}

function decisionClass(row: ForgeMatchMapping): string {
  if (row.match_decision === "matched") return "fm-queue-dot-matched";
  if (row.match_decision === "ambiguous") return "fm-queue-dot-ambiguous";
  return "fm-queue-dot-no-match";
}

export default function ForgeMatchQueueList({ rows, selectedMappingId, onSelect }: Props) {
  return (
    <section className="fm-queue" aria-label="Review queue">
      <header className="fm-queue-head">
        <h3>Review Queue</h3>
        <span>{rows.length} items</span>
      </header>

      <div className="fm-queue-items" role="listbox" aria-label="ForgeMatch review queue list">
        {rows.length === 0 ? (
          <div className="fm-queue-empty">No rows match current filters.</div>
        ) : (
          rows.map((row) => {
            const selected = row.mapping_id === selectedMappingId;
            return (
              <button
                key={row.mapping_id}
                type="button"
                className={`fm-queue-item ${selected ? "is-selected" : ""}`}
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(row.mapping_id)}
              >
                <div className="fm-queue-title-row">
                  <span className={`fm-queue-dot ${decisionClass(row)}`} aria-hidden="true" />
                  <strong>{row.source_field_name ?? "Unnamed source field"}</strong>
                </div>
                <div className="fm-queue-subtitle">{bestMatchLabel(row)}</div>
                <div className="fm-queue-meta-row">
                  <ForgeMatchConfidencePill score={row.confidence_score} band={row.confidence_band} />
                  <ForgeMatchStatusBadge status={row.status} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
