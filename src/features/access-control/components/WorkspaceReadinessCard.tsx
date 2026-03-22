import type { WorkspaceReadiness } from "../types";
import "../accessControl.css";

type Props = {
  readiness?: WorkspaceReadiness | null;
  isLoading?: boolean;
  error?: string | null;
};

function statusChip(value: boolean, trueLabel: string, falseLabel: string) {
  return (
    <span className={`ac-status-chip ${value ? "is-granted" : "is-blocked"}`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

export default function WorkspaceReadinessCard({ readiness, isLoading = false, error = null }: Props) {
  return (
    <div className="ac-panel h-100">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h6 className="mb-1">Workspace Readiness</h6>
          <div className="small ac-muted">Bootstrap state for feature entitlements and role coverage.</div>
        </div>
        {readiness ? statusChip(readiness.setup_complete, "Ready", "Setup Needed") : null}
      </div>

      {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}
      {isLoading ? <div className="small ac-muted">Loading workspace readiness…</div> : null}
      {!isLoading && !error && readiness ? (
        <div className="ac-readiness-grid">
          <div className="ac-surface p-3">
            <div className="small text-uppercase ac-muted">Workspace Admin</div>
            <div className="fw-semibold mt-1">
              {readiness.has_workspace_admin ? "Assigned" : "Missing"}
            </div>
          </div>
          <div className="ac-surface p-3">
            <div className="small text-uppercase ac-muted">Enabled Features</div>
            <div className="fw-semibold mt-1">{readiness.enabled_feature_count}</div>
          </div>
          <div className="ac-surface p-3">
            <div className="small text-uppercase ac-muted">Super User</div>
            <div className="fw-semibold mt-1">
              {readiness.super_user_present ? "Present" : "Not Set"}
            </div>
          </div>
        </div>
      ) : null}
      {!isLoading && !error && readiness ? (
        <div className="mt-3 small ac-muted">
          Missing steps: {readiness.missing_steps.length > 0 ? readiness.missing_steps.join(", ") : "None"}
        </div>
      ) : null}
    </div>
  );
}
