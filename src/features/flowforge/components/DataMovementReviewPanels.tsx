import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getFlowForgeDatasetArtifact,
  listFlowForgeDataMovementAudit,
  listFlowForgeDatasetArtifacts,
} from "../api/dataMovementApi";
import type { FlowForgeDatasetArtifact } from "../model/dataMovementTypes";
import StatusBadge from "./StatusBadge";
import { formatFlowForgeDate, summarizeJson } from "./runtimeFormat";
import "../ui/flowforgeAdmin.css";

type DataMovementReviewPanelsProps = {
  runId?: number | null;
  limit?: number;
};

const readInvalidRows = (artifact?: FlowForgeDatasetArtifact | null) => {
  const validation = artifact?.schema?.validation;
  if (!validation || typeof validation !== "object") return [];
  const rows = (validation as { invalid_rows?: unknown }).invalid_rows;
  return Array.isArray(rows) ? rows : [];
};

export default function DataMovementReviewPanels({ runId = null, limit = 100 }: DataMovementReviewPanelsProps) {
  const [selectedArtifactId, setSelectedArtifactId] = useState<number | null>(null);
  const artifactsQuery = useQuery({
    queryKey: ["flowforge", "data-movement", "artifacts", { runId, limit }],
    queryFn: () => listFlowForgeDatasetArtifacts({ runId, limit, offset: 0 }),
  });
  const auditQuery = useQuery({
    queryKey: ["flowforge", "data-movement", "audit", { runId, limit }],
    queryFn: () => listFlowForgeDataMovementAudit({ runId, limit, offset: 0 }),
  });
  const artifactDetailQuery = useQuery({
    queryKey: ["flowforge", "data-movement", "artifact", selectedArtifactId],
    queryFn: () => getFlowForgeDatasetArtifact(selectedArtifactId as number),
    enabled: Boolean(selectedArtifactId),
  });
  const artifacts = artifactsQuery.data?.artifacts ?? [];
  const audit = auditQuery.data?.audit ?? [];
  const selectedArtifact = artifactDetailQuery.data ?? artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null;
  const invalidRows = readInvalidRows(selectedArtifact);

  return (
    <div className="ff-runtime-grid ff-data-movement-review-grid">
      <section className="ff-runtime-panel">
        <h2>Artifacts</h2>
        {artifactsQuery.isLoading ? <div className="ff-empty-state">Loading artifacts...</div> : null}
        {artifactsQuery.isError ? <div className="ff-empty-state">Unable to load artifacts.</div> : null}
        {!artifacts.length && !artifactsQuery.isLoading ? <div className="ff-empty-state">No dataset artifacts found.</div> : null}
        <div className="ff-data-movement-list">
          {artifacts.map((artifact) => (
            <button
              type="button"
              className={`ff-data-movement-row ${selectedArtifactId === artifact.id ? "is-active" : ""}`}
              key={artifact.id}
              onClick={() => setSelectedArtifactId(artifact.id)}
            >
              <span>
                <strong>{artifact.artifact_key}</strong>
                <small>
                  {artifact.artifact_type} - {artifact.row_count ?? 0} rows - {formatFlowForgeDate(artifact.created_at)}
                </small>
              </span>
              <StatusBadge status={artifact.status} />
            </button>
          ))}
        </div>
        {selectedArtifact ? (
          <div className="ff-data-movement-detail" aria-label="Artifact detail">
            <h3>Artifact {selectedArtifact.id}</h3>
            <dl>
              <div>
                <dt>Storage</dt>
                <dd>{selectedArtifact.storage_kind}</dd>
              </div>
              <div>
                <dt>Checksum</dt>
                <dd>{selectedArtifact.checksum || "Not set"}</dd>
              </div>
              <div>
                <dt>Schema</dt>
                <dd>{summarizeJson(selectedArtifact.schema)}</dd>
              </div>
            </dl>
            {invalidRows.length ? (
              <div className="ff-data-movement-failures">
                <h4>Validation Failures</h4>
                {invalidRows.slice(0, 10).map((row, index) => (
                  <pre key={index}>{JSON.stringify(row, null, 2)}</pre>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="ff-runtime-panel">
        <h2>Data Movement Audit</h2>
        {auditQuery.isLoading ? <div className="ff-empty-state">Loading audit rows...</div> : null}
        {auditQuery.isError ? <div className="ff-empty-state">Unable to load data movement audit.</div> : null}
        {!audit.length && !auditQuery.isLoading ? <div className="ff-empty-state">No data movement audit rows found.</div> : null}
        <div className="ff-data-movement-list">
          {audit.map((entry) => (
            <article className="ff-data-movement-audit-row" key={entry.id}>
              <div>
                <strong>{entry.action_type.replace("_", " ")}</strong>
                <small>
                  {entry.source_key || "no source"} to {entry.destination_key || "no destination"}
                </small>
              </div>
              <StatusBadge status={entry.status} />
              {entry.error_message ? <p>{entry.error_message}</p> : null}
              <small>{summarizeJson(entry.result)}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
