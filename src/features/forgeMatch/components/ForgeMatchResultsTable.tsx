import ForgeMatchConfidencePill from "./ForgeMatchConfidencePill";
import ForgeMatchStatusBadge from "./ForgeMatchStatusBadge";
import type { ForgeMatchMapping } from "../types";

type Props = {
  rows: ForgeMatchMapping[];
  isSaving?: boolean;
  onAccept: (row: ForgeMatchMapping) => Promise<void>;
  onReject: (row: ForgeMatchMapping) => Promise<void>;
  onNeedsReview: (row: ForgeMatchMapping) => Promise<void>;
  onOpenDrawer: (row: ForgeMatchMapping) => void;
};

function renderBestMatch(row: ForgeMatchMapping): string {
  if (!row.best_match) return "No match";
  const table = row.best_match.table_name ?? "";
  const column = row.best_match.column_name ?? "";
  return `${table}.${column}`.replace(/^\./, "") || "No match";
}

function renderAlternates(row: ForgeMatchMapping): string {
  if (row.alternates.length === 0) return "-";
  return row.alternates
    .slice(0, 2)
    .map((candidate) => `${candidate.table_name ?? ""}.${candidate.column_name ?? ""}`.replace(/^\./, ""))
    .join(" | ");
}

export default function ForgeMatchResultsTable({
  rows,
  isSaving,
  onAccept,
  onReject,
  onNeedsReview,
  onOpenDrawer,
}: Props) {
  return (
    <section className="fm-card fm-table-card" aria-label="ForgeMatch review grid">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">Table Review</h2>
          <p className="fm-card-subtitle">Compact scan view. Click a row to inspect evidence and use the drawer for remap or notes.</p>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle fm-results-table">
          <thead className="fm-sticky-head">
            <tr>
              <th>Source Field</th>
              <th>Best Match</th>
              <th>Confidence</th>
              <th>Decision</th>
              <th>Status</th>
              <th className="text-nowrap fm-results-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted text-center py-3">No mappings yet. Run Analyze to generate mappings.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.mapping_id} className="fm-results-row" onClick={() => onOpenDrawer(row)}>
                  <td>
                    <div className="fm-results-primary">{row.source_field_name ?? "-"}</div>
                    <div className="fm-results-secondary">{row.source_description ?? row.source_type ?? "-"}</div>
                    <div className="fm-results-tertiary">{row.source_type ?? "-"} · {row.source_object_name ?? "-"}</div>
                  </td>
                  <td>
                    <div className="fm-results-primary">{renderBestMatch(row)}</div>
                    <div className="fm-results-secondary fm-cell-clamp" title={row.explanation ?? ""}>{row.explanation ?? "No explanation provided."}</div>
                    <div className="fm-results-tertiary fm-cell-clamp" title={renderAlternates(row)}>
                      Alternates: {renderAlternates(row)}
                    </div>
                  </td>
                  <td><ForgeMatchConfidencePill score={row.confidence_score} band={row.confidence_band} /></td>
                  <td><span className="text-capitalize">{row.match_decision.replaceAll("_", " ")}</span></td>
                  <td><ForgeMatchStatusBadge status={row.status} /></td>
                  <td>
                    <div className="fm-results-actions" role="group" aria-label={`Actions for ${row.source_field_name ?? row.mapping_id}`}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        aria-label={`Review ${row.source_field_name ?? row.mapping_id}`}
                        title="Review details"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDrawer(row);
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        disabled={isSaving}
                        aria-label={`Accept ${row.source_field_name ?? row.mapping_id}`}
                        title="Accept"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onAccept(row);
                        }}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-warning"
                        disabled={isSaving}
                        aria-label={`Mark ${row.source_field_name ?? row.mapping_id} for review`}
                        title="Needs review"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onNeedsReview(row);
                        }}
                      >
                        !
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={isSaving}
                        aria-label={`Reject ${row.source_field_name ?? row.mapping_id}`}
                        title="Reject"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onReject(row);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
