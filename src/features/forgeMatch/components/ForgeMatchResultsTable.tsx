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
  onManualRemap: (row: ForgeMatchMapping) => void;
  onEditNotes: (row: ForgeMatchMapping) => void;
};

function renderBestMatch(row: ForgeMatchMapping): string {
  if (!row.best_match) return "No match";
  return row.best_match.column_name ?? "No match";
}

function renderDomainTable(row: ForgeMatchMapping): string {
  if (!row.best_match) return "-";
  return row.best_match.table_name ?? "-";
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
  onManualRemap,
  onEditNotes,
}: Props) {
  return (
    <section className="fm-card fm-table-card" aria-label="ForgeMatch review grid">
      <h2 className="fm-card-title">Table Review</h2>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle fm-results-table">
          <thead className="fm-sticky-head">
            <tr>
              <th>Source Field</th>
              <th>Description</th>
              <th>Type</th>
              <th>Best Match</th>
              <th>Domain / Table</th>
              <th>Alternates</th>
              <th>Confidence</th>
              <th>Decision</th>
              <th>Status</th>
              <th>Explanation</th>
              <th className="text-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-muted text-center py-3">No mappings yet. Run Analyze to generate mappings.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.mapping_id}>
                  <td className="fw-semibold">{row.source_field_name ?? "-"}</td>
                  <td>{row.source_description ?? "-"}</td>
                  <td>{row.source_type ?? "-"}</td>
                  <td>{renderBestMatch(row)}</td>
                  <td>{renderDomainTable(row)}</td>
                  <td className="fm-cell-clamp" title={renderAlternates(row)}>{renderAlternates(row)}</td>
                  <td><ForgeMatchConfidencePill score={row.confidence_score} band={row.confidence_band} /></td>
                  <td><span className="text-capitalize">{row.match_decision.replaceAll("_", " ")}</span></td>
                  <td><ForgeMatchStatusBadge status={row.status} /></td>
                  <td className="fm-cell-clamp" title={row.explanation ?? ""}>{row.explanation ?? "-"}</td>
                  <td>
                    <div className="btn-group btn-group-sm" role="group" aria-label={`Actions for ${row.source_field_name ?? row.mapping_id}`}>
                      <button type="button" className="btn btn-outline-success" disabled={isSaving} onClick={() => void onAccept(row)}>Accept</button>
                      <button type="button" className="btn btn-outline-danger" disabled={isSaving} onClick={() => void onReject(row)}>Reject</button>
                      <button type="button" className="btn btn-outline-warning" disabled={isSaving} onClick={() => void onNeedsReview(row)}>Needs Review</button>
                      <button type="button" className="btn btn-outline-primary" onClick={() => onManualRemap(row)}>Remap</button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => onEditNotes(row)}>Edit Notes</button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => onOpenDrawer(row)}>Details</button>
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
