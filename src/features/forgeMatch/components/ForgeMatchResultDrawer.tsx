import type { ForgeMatchMapping } from "../types";
import ForgeMatchConfidencePill from "./ForgeMatchConfidencePill";
import ForgeMatchStatusBadge from "./ForgeMatchStatusBadge";

type Props = {
  row: ForgeMatchMapping | null;
  open: boolean;
  onClose: () => void;
  onManualRemap: (row: ForgeMatchMapping) => void;
};

export default function ForgeMatchResultDrawer({ row, open, onClose, onManualRemap }: Props) {
  if (!open || !row) return null;
  const bestCandidateEvidence = row.best_match
    ? row.retrieved_candidates.find((candidate) => candidate.column_id === row.best_match?.column_id)
    : null;

  return (
    <div className="fm-drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="fm-drawer"
        role="dialog"
        aria-label={`ForgeMatch details for ${row.source_field_name ?? row.mapping_id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fm-drawer-header">
          <div>
            <h3 className="mb-1">{row.source_field_name ?? "Source field"}</h3>
            <div className="d-flex align-items-center gap-2">
              <ForgeMatchConfidencePill score={row.confidence_score} band={row.confidence_band} />
              <ForgeMatchStatusBadge status={row.status} />
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
        </header>

        <section className="fm-drawer-section">
          <h4 className="fm-drawer-subtitle">Source Metadata</h4>
          <div className="small">
            <div><strong>Description:</strong> {row.source_description ?? "-"}</div>
            <div><strong>Type:</strong> {row.source_type ?? "-"}</div>
            <div><strong>Source Object:</strong> {row.source_object_name ?? "-"}</div>
            <div><strong>Sample Value:</strong> {row.sample_value ?? "-"}</div>
            <div><strong>Provenance:</strong> {row.sheet_name ?? "-"} row {row.row_number ?? "-"}</div>
          </div>
        </section>

        <section className="fm-drawer-section">
          <h4 className="fm-drawer-subtitle">Decision</h4>
          <div className="small text-capitalize"><strong>{row.match_decision.replaceAll("_", " ")}</strong></div>
          <p className="small mb-1 mt-2">{row.explanation ?? "No explanation provided."}</p>
          <div className="small text-muted">Reason Codes: {row.reason_codes.join(", ") || "-"}</div>
          {bestCandidateEvidence ? (
            <div className="small mt-2">
              <div><strong>Retrieval Score:</strong> {bestCandidateEvidence.retrieval_score ?? "-"}</div>
              <div><strong>Lexical Score:</strong> {bestCandidateEvidence.lexical_score ?? "-"}</div>
              <div><strong>Composite Score:</strong> {bestCandidateEvidence.score ?? "-"}</div>
            </div>
          ) : null}
        </section>

        <section className="fm-drawer-section">
          <h4 className="fm-drawer-subtitle">Best Match</h4>
          {row.best_match ? (
            <div>
              <div className="fw-semibold">{row.best_match.table_name ?? ""}.{row.best_match.column_name ?? ""}</div>
              <div className="small text-muted">Workspace Column ID {row.best_match.column_id}</div>
            </div>
          ) : (
            <div className="small text-muted">No best match.</div>
          )}
        </section>

        <section className="fm-drawer-section">
          <h4 className="fm-drawer-subtitle">Alternates</h4>
          {row.alternates.length === 0 ? (
            <div className="small text-muted">No alternates.</div>
          ) : (
            <ul className="list-group list-group-flush">
              {row.alternates.slice(0, 2).map((candidate, index) => (
                <li className="list-group-item px-0" key={`${row.mapping_id}-alt-${candidate.column_id ?? index}`}>
                  <div className="fw-semibold">{candidate.table_name ?? ""}.{candidate.column_name ?? ""}</div>
                  <div className="small text-muted">Workspace Column ID {candidate.column_id ?? "-"}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="fm-drawer-section d-flex justify-content-end">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onManualRemap(row)}>
            Manual Remap
          </button>
        </section>
      </aside>
    </div>
  );
}
