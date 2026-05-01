import type { FeedbackLearningCandidateDetail } from "../../model/types";

type Props = {
  detail: FeedbackLearningCandidateDetail | null;
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

function JsonBlock({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown> | null | undefined;
}) {
  return (
    <section className="sa-drawer-form-card">
      <h3 className="sa-drawer-form-card-title">{label}</h3>
      <pre className="sa-json-preview mb-0">{JSON.stringify(value ?? {}, null, 2)}</pre>
    </section>
  );
}

export function CandidateDetailsDrawer({
  detail,
  open,
  loading = false,
  error,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="sa-drawer-backdrop">
      <aside className="sa-drawer" role="dialog" aria-label="Feedback Learning Candidate">
        <div className="sa-drawer-header">
          <div>
            <div className="small text-uppercase text-muted">Candidate Detail</div>
            <h2 className="sa-drawer-header-title">
              Candidate #{detail?.candidate.id ?? "—"}
            </h2>
          </div>
          <button type="button" className="btn btn-sm btn-light" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="sa-drawer-body">
          {loading ? (
            <div className="sa-loading">
              <span className="sa-spinner lg" />
              Loading candidate detail…
            </div>
          ) : error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : detail ? (
            <>
              <section className="sa-drawer-form-card">
                <h3 className="sa-drawer-form-card-title">Review Summary</h3>
                <div className="sa-card-body">
                  <div className="sa-card-metric">
                    <span className="sa-card-metric-label">Target</span>
                    <span className="sa-card-metric-value">
                      {detail.candidate.target_type.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="sa-card-metric">
                    <span className="sa-card-metric-label">Effective Target Key</span>
                    <span className="sa-card-metric-value">
                      {detail.effective_target_key ?? "—"}
                    </span>
                  </div>
                  <div className="sa-card-metric">
                    <span className="sa-card-metric-label">Governance Status</span>
                    <span className="sa-card-metric-value">
                      {detail.candidate.governance_status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="sa-card-metric">
                    <span className="sa-card-metric-label">Failure Verdict</span>
                    <span className="sa-card-metric-value">
                      {detail.analysis_summary?.failure_verdict ?? "—"}
                    </span>
                  </div>
                  <div className="sa-card-metric">
                    <span className="sa-card-metric-label">Prompt Feedback</span>
                    <span className="sa-card-metric-value">
                      #{detail.source_feedback?.prompt_feedback_id ?? "—"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="sa-drawer-form-card">
                <h3 className="sa-drawer-form-card-title">Source Feedback</h3>
                <div className="sa-card-body">
                  <div className="mb-2">
                    <strong>Normalized Prompt:</strong>{" "}
                    {detail.source_feedback?.normalized_prompt ?? "—"}
                  </div>
                  <div>
                    <strong>Original Prompt:</strong>{" "}
                    {detail.source_feedback?.prompt_text ?? "—"}
                  </div>
                </div>
              </section>

              <JsonBlock label="Payload" value={detail.candidate.payload_json} />
              <JsonBlock
                label="Analysis JSON"
                value={detail.analysis_summary?.analysis_json ?? null}
              />
            </>
          ) : (
            <div className="alert alert-light mb-0">No candidate selected.</div>
          )}
        </div>
      </aside>
    </div>
  );
}
