import { useMemo, useState } from "react";
import type { SkillLogEvent, SkillRun } from "../types";

type Props = {
  runs: SkillRun[];
  isLoading?: boolean;
  disabled?: boolean;
};

const STATUS_CLASS: Record<string, string> = {
  success: "success",
  failed: "danger",
  skipped: "secondary",
  pending: "warning",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toLocaleString();
}

function deriveTimeline(run: SkillRun): SkillLogEvent[] {
  if (run.events.length) return run.events;
  return [
    {
      id: `${run.id}:summary`,
      status: run.status,
      timestamp: run.finishedAt ?? run.startedAt,
      message: run.message,
    },
  ];
}

function prettyJson(value: Record<string, unknown> | null): string {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export default function SkillRunsPanel({ runs, isLoading = false, disabled = false }: Props) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = useMemo(() => {
    if (!runs.length) return null;
    if (!selectedRunId) return runs[0];
    return runs.find((run) => run.id === selectedRunId) ?? runs[0];
  }, [runs, selectedRunId]);

  if (disabled) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body text-muted">Save the skill to view run history.</div>
      </div>
    );
  }

  return (
    <div className="row g-3">
      <div className="col-lg-5">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <h3 className="h6 mb-3">Recent Runs</h3>
            {isLoading ? <div className="text-muted">Loading runs...</div> : null}
            {!isLoading && runs.length === 0 ? (
              <div className="text-muted small">No run history available yet.</div>
            ) : null}
            <div className="list-group">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className={`list-group-item list-group-item-action ${selectedRun?.id === run.id ? "active" : ""}`}
                  onClick={() => setSelectedRunId(run.id)}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span>{formatDate(run.startedAt)}</span>
                    <span className={`badge text-bg-${STATUS_CLASS[run.status] ?? "secondary"}`}>{run.status}</span>
                  </div>
                  <div className="small">{run.message}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-7">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <h3 className="h6 mb-3">Run Details</h3>
            {!selectedRun ? <div className="text-muted small">Select a run to inspect events.</div> : null}
            {selectedRun ? (
              <div className="skills-run-detail">
                <div className="skills-run-detail__summary">
                  <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold mb-1">Outcome</div>
                      <div className="fw-semibold">{selectedRun.message}</div>
                    </div>
                    <span className={`badge text-bg-${STATUS_CLASS[selectedRun.status] ?? "secondary"}`}>{selectedRun.status}</span>
                  </div>
                  {selectedRun.errorMessage ? (
                    <div className="skills-run-detail__alert mt-3">
                      <div className="fw-semibold mb-1">Error</div>
                      <pre className="mb-0">{selectedRun.errorMessage}</pre>
                    </div>
                  ) : null}
                  <div className="skills-run-detail__grid mt-3">
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold mb-1">Queued</div>
                      <div>{formatDate(selectedRun.createdAt)}</div>
                    </div>
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold mb-1">Started</div>
                      <div>{formatDate(selectedRun.startedAt)}</div>
                    </div>
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold mb-1">Finished</div>
                      <div>{formatDate(selectedRun.finishedAt)}</div>
                    </div>
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold mb-1">Duration</div>
                      <div>{selectedRun.durationMs != null ? `${selectedRun.durationMs} ms` : "-"}</div>
                    </div>
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold mb-1">Triggered By</div>
                      <div>{selectedRun.triggeredBy || "-"}</div>
                    </div>
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold mb-1">Job Id</div>
                      <div className="text-break">{selectedRun.jobId || "-"}</div>
                    </div>
                  </div>
                </div>

                <div className="skills-run-detail__section mt-4">
                  <div className="small text-muted text-uppercase fw-semibold mb-2">Timeline</div>
                  <ul className="skills-timeline list-unstyled mb-0">
                    {deriveTimeline(selectedRun).map((event) => (
                      <li key={event.id}>
                        <div className="skills-timeline-dot" />
                        <div className="skills-timeline-content">
                          <div className="d-flex justify-content-between gap-2">
                            <span className="fw-semibold">{event.message}</span>
                            <span className="text-muted small">{formatDate(event.timestamp)}</span>
                          </div>
                          <div className="small text-muted">{String(event.status).toUpperCase()}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedRun.result ? (
                  <div className="skills-run-detail__section mt-4">
                    <div className="small text-muted text-uppercase fw-semibold mb-2">Result Payload</div>
                    <pre className="skills-run-detail__json mb-0">{prettyJson(selectedRun.result)}</pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
