import ForgeMatchConfidenceBar from "./ForgeMatchConfidenceBar";
import ForgeMatchConfidencePill from "./ForgeMatchConfidencePill";
import ForgeMatchStatusBadge from "./ForgeMatchStatusBadge";
import type { ForgeMatchMapping } from "../types";

type Props = {
  row: ForgeMatchMapping | null;
  isSaving?: boolean;
  onAccept: (row: ForgeMatchMapping) => Promise<void>;
  onReject: (row: ForgeMatchMapping) => Promise<void>;
  onNeedsReview: (row: ForgeMatchMapping) => Promise<void>;
  onManualRemap: (row: ForgeMatchMapping) => void;
  onEditNotes: (row: ForgeMatchMapping) => void;
  onOpenDrawer: (row: ForgeMatchMapping) => void;
};

function candidateLabel(candidate: { table_name?: string | null; column_name?: string | null }): string {
  const table = candidate.table_name ?? "";
  const column = candidate.column_name ?? "";
  return `${table}.${column}`.replace(/^\./, "") || "Unknown candidate";
}

function metric(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value <= 1) return `${(value * 100).toFixed(1)}%`;
  return `${value.toFixed(2)}`;
}

export default function ForgeMatchInspector({
  row,
  isSaving,
  onAccept,
  onReject,
  onNeedsReview,
  onManualRemap,
  onEditNotes,
  onOpenDrawer,
}: Props) {
  if (!row) {
    return (
      <section className="fm-inspector fm-inspector-empty" aria-label="Field inspector">
        <h3>Field Inspector</h3>
        <p>Select a queue item to inspect mapping evidence and take review actions.</p>
      </section>
    );
  }

  const bestCandidateEvidence = row.best_match
    ? row.retrieved_candidates.find((candidate) => candidate.column_id === row.best_match?.column_id)
    : null;

  return (
    <section className="fm-inspector" aria-label={`Field inspector for ${row.source_field_name ?? row.mapping_id}`}>
      <header className="fm-inspector-head">
        <div>
          <h3>{row.source_field_name ?? "Source field"}</h3>
          <p>{row.source_description ?? "No source description provided."}</p>
        </div>
        <div className="fm-inspector-badges">
          <ForgeMatchConfidencePill score={row.confidence_score} band={row.confidence_band} />
          <ForgeMatchStatusBadge status={row.status} />
        </div>
      </header>

      <ForgeMatchConfidenceBar score={row.confidence_score} band={row.confidence_band} />

      <div className="fm-inspector-grid">
        <div className="fm-inspector-card">
          <h4>Source Metadata</h4>
          <dl>
            <dt>Type</dt><dd>{row.source_type ?? "-"}</dd>
            <dt>Source Object</dt><dd>{row.source_object_name ?? "-"}</dd>
            <dt>Sample Value</dt><dd>{row.sample_value ?? "-"}</dd>
            <dt>Provenance</dt><dd>{row.sheet_name ?? "-"} row {row.row_number ?? "-"}</dd>
          </dl>
        </div>

        <div className="fm-inspector-card">
          <h4>Best Match</h4>
          {row.best_match ? (
            <>
              <p className="fm-best-match">{candidateLabel(row.best_match)}</p>
              <p className="fm-muted mb-1">Workspace Column ID {row.best_match.column_id}</p>
              <p className="mb-2">{row.explanation ?? "No explanation provided."}</p>
            </>
          ) : (
            <p className="fm-muted">No confident best match was selected.</p>
          )}

          {bestCandidateEvidence ? (
            <div className="fm-breakdown">
              <strong>Score Breakdown</strong>
              <div className="fm-breakdown-row"><span>Retrieval Score</span><span>{metric(bestCandidateEvidence.retrieval_score)}</span></div>
              <div className="fm-breakdown-row"><span>Lexical Score</span><span>{metric(bestCandidateEvidence.lexical_score)}</span></div>
              <div className="fm-breakdown-row"><span>Composite Score</span><span>{metric(bestCandidateEvidence.score)}</span></div>
            </div>
          ) : (
            <div className="fm-breakdown">
              <strong>Reason Codes</strong>
              <p className="mb-0">{row.reason_codes.length > 0 ? row.reason_codes.join(", ") : "-"}</p>
            </div>
          )}
        </div>
      </div>

      <section className="fm-inspector-card">
        <h4>Alternate Candidates</h4>
        {row.alternates.length === 0 ? (
          <p className="fm-muted">No alternates returned.</p>
        ) : (
          <div className="fm-alternate-grid">
            {row.alternates.slice(0, 3).map((candidate, index) => (
              <div className="fm-alternate-card" key={`${row.mapping_id}-alternate-${candidate.column_id ?? index}`}>
                <strong>{candidateLabel(candidate)}</strong>
                <span>Column ID {candidate.column_id ?? "-"}</span>
                <span>Score {metric(candidate.score)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="fm-inspector-actions" aria-label="Review actions">
        <button type="button" className="btn btn-success" disabled={isSaving} onClick={() => void onAccept(row)}>Accept</button>
        <button type="button" className="btn btn-outline-danger" disabled={isSaving} onClick={() => void onReject(row)}>Reject</button>
        <button type="button" className="btn btn-outline-warning" disabled={isSaving} onClick={() => void onNeedsReview(row)}>Needs Review</button>
        <button type="button" className="btn btn-primary" onClick={() => onManualRemap(row)}>Remap</button>
        <button type="button" className="btn btn-outline-secondary" onClick={() => onEditNotes(row)}>Edit Notes</button>
        <button type="button" className="btn btn-outline-secondary" onClick={() => onOpenDrawer(row)}>Details</button>
      </section>
    </section>
  );
}
