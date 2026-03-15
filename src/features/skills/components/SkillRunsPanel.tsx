import { useMemo, useState } from "react";
import type { SkillRun } from "../types";

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
            <h3 className="h6 mb-3">Event Timeline</h3>
            {!selectedRun ? <div className="text-muted small">Select a run to inspect events.</div> : null}
            {selectedRun ? (
              <ul className="skills-timeline list-unstyled mb-0">
                {selectedRun.events.length ? (
                  selectedRun.events.map((event) => (
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
                  ))
                ) : (
                  <li>
                    <div className="skills-timeline-dot" />
                    <div className="skills-timeline-content text-muted small">No event timeline recorded for this run.</div>
                  </li>
                )}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
