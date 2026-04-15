import type {
  ForgeMatchMapping,
  ForgeMatchSessionRecord,
  ForgeMatchSharedPipelineSnapshot,
  ForgeMatchSharedPipelineTraceNode,
} from "../types";
import ForgeMatchConfidencePill from "./ForgeMatchConfidencePill";
import ForgeMatchStatusBadge from "./ForgeMatchStatusBadge";

type Props = {
  row: ForgeMatchMapping | null;
  session: ForgeMatchSessionRecord | null;
  open: boolean;
  onClose: () => void;
  onManualRemap: (row: ForgeMatchMapping) => void;
};

export default function ForgeMatchResultDrawer({ row, session, open, onClose, onManualRemap }: Props) {
  if (!open || !row) return null;
  const bestCandidateEvidence = row.best_match
    ? row.retrieved_candidates.find((candidate) => candidate.column_id === row.best_match?.column_id)
    : null;
  const rowPipeline = row.shared_pipeline ?? null;
  const sessionPipeline = getSessionPipeline(session);

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

        {sessionPipeline ? (
          <section className="fm-drawer-section">
            <h4 className="fm-drawer-subtitle">Session Pipeline</h4>
            <PipelineSnapshotCard snapshot={sessionPipeline} />
          </section>
        ) : null}

        {rowPipeline ? (
          <section className="fm-drawer-section">
            <h4 className="fm-drawer-subtitle">Row Pipeline</h4>
            <PipelineSnapshotCard snapshot={rowPipeline} />
          </section>
        ) : null}

        <section className="fm-drawer-section d-flex justify-content-end">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onManualRemap(row)}>
            Manual Remap
          </button>
        </section>
      </aside>
    </div>
  );
}

function PipelineSnapshotCard({ snapshot }: { snapshot: ForgeMatchSharedPipelineSnapshot }) {
  const traceNodes = Array.isArray(snapshot.trace_nodes) ? snapshot.trace_nodes : [];
  const extractedSignals = getSignals(snapshot);
  const capabilityCounts = getCapabilityCounts(snapshot);

  return (
    <div className="fm-pipeline-card">
      <div className="fm-pipeline-meta">
        <div>
          <div className="fm-pipeline-title">{snapshot.pipeline_name ?? "Shared pipeline"}</div>
          {snapshot.trace_id ? <div className="fm-pipeline-muted">Trace {snapshot.trace_id}</div> : null}
        </div>
      </div>

      {extractedSignals.length > 0 ? (
        <div className="fm-pipeline-chip-row">
          {extractedSignals.map((signal) => (
            <span key={signal} className="fm-pipeline-chip">
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      {capabilityCounts.length > 0 ? (
        <div className="fm-pipeline-capability-list">
          {capabilityCounts.map(({ candidateId, count }) => (
            <div key={candidateId} className="fm-pipeline-capability-item">
              <span>Candidate {candidateId}</span>
              <strong>{count} capabilities</strong>
            </div>
          ))}
        </div>
      ) : null}

      {traceNodes.length > 0 ? (
        <div className="fm-pipeline-node-list">
          {traceNodes.map((node, index) => (
            <PipelineTraceNodeCard key={`${node.pipeline_name ?? "pipeline"}-${node.node ?? index}-${index}`} node={node} />
          ))}
        </div>
      ) : (
        <div className="small text-muted">No node trace captured.</div>
      )}
    </div>
  );
}

function PipelineTraceNodeCard({ node }: { node: ForgeMatchSharedPipelineTraceNode }) {
  const lineage = Array.isArray(node.lineage) ? node.lineage.filter(Boolean) : [];

  return (
    <div className="fm-pipeline-node-card">
      <div className="fm-pipeline-node-header">
        <strong>{titleCase(node.node ?? "unknown")}</strong>
        <span className="fm-pipeline-node-status">{titleCase(node.status ?? "unknown")}</span>
      </div>
      <div className="fm-pipeline-muted">
        {typeof node.ms === "number" ? `${node.ms} ms` : "n/a"}
        {lineage.length > 0 ? ` · ${lineage.join(" > ")}` : ""}
      </div>
      {node.summary && Object.keys(node.summary).length > 0 ? (
        <pre className="fm-json mt-2">{JSON.stringify(node.summary, null, 2)}</pre>
      ) : null}
      {node.error ? <div className="small text-danger mt-2">{node.error}</div> : null}
    </div>
  );
}

function getSessionPipeline(session: ForgeMatchSessionRecord | null): ForgeMatchSharedPipelineSnapshot | null {
  if (!session || !session.summary_json || typeof session.summary_json !== "object") return null;
  const summary = session.summary_json as { analysis_trace?: ForgeMatchSharedPipelineSnapshot };
  if (!summary.analysis_trace || typeof summary.analysis_trace !== "object") return null;
  return summary.analysis_trace;
}

function getSignals(snapshot: ForgeMatchSharedPipelineSnapshot): string[] {
  const debug = snapshot.debug;
  if (!debug || typeof debug !== "object") return [];
  const extractSignals = (debug as Record<string, unknown>).extract_signals;
  if (!extractSignals || typeof extractSignals !== "object") return [];
  const signals = (extractSignals as { signals?: unknown }).signals;
  if (!Array.isArray(signals)) return [];
  return signals.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function getCapabilityCounts(snapshot: ForgeMatchSharedPipelineSnapshot): Array<{ candidateId: string; count: number }> {
  const debug = snapshot.debug;
  if (!debug || typeof debug !== "object") return [];
  const resolveCapabilities = (debug as Record<string, unknown>).resolve_capabilities;
  if (!resolveCapabilities || typeof resolveCapabilities !== "object") return [];
  const capabilityCounts = (resolveCapabilities as { capability_counts?: unknown }).capability_counts;
  if (!capabilityCounts || typeof capabilityCounts !== "object") return [];
  return Object.entries(capabilityCounts as Record<string, unknown>)
    .map(([candidateId, count]) => ({
      candidateId,
      count: typeof count === "number" ? count : Number(count ?? 0),
    }))
    .filter((item) => Number.isFinite(item.count) && item.count > 0);
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}
