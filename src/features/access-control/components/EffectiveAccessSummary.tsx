import { FEATURE_BY_KEY } from "../constants";
import type { EffectiveAccessEntry } from "../types";
import "../accessControl.css";

function statusClass(status: EffectiveAccessEntry["status"]): string {
  if (status === "granted") return "is-granted";
  if (status === "blocked_feature") return "is-blocked";
  return "is-empty";
}

function accessLabel(entry: EffectiveAccessEntry): string {
  if (entry.status === "blocked_feature") return "No Access";
  if (entry.access_level === "admin") return "Admin";
  if (entry.access_level === "user") return "User";
  if (entry.access_level === "viewer") return "Viewer";
  return "No Access";
}

type Props = {
  entries?: EffectiveAccessEntry[];
  isLoading?: boolean;
  error?: string | null;
};

export default function EffectiveAccessSummary({ entries = [], isLoading = false, error = null }: Props) {
  return (
    <div className="ac-panel h-100">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h6 className="mb-1">Effective Access</h6>
          <div className="small ac-muted">Feature access combines workspace entitlements and assigned roles.</div>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}
      {isLoading ? <div className="small ac-muted">Loading effective access…</div> : null}
      {!isLoading && !error && entries.length === 0 ? (
        <div className="ac-empty-state">No effective access details available for this workspace.</div>
      ) : null}
      {!isLoading && !error && entries.length > 0 ? (
        <table className="ac-summary-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Access</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.feature_key}>
                <td>
                  <div className="fw-semibold">{FEATURE_BY_KEY.get(entry.feature_key)?.label ?? entry.feature_name}</div>
                  <div className="small ac-muted">{entry.assigned_role_name ?? "No assigned role"}</div>
                </td>
                <td>
                  <span className={`ac-status-chip ${statusClass(entry.status)}`}>{accessLabel(entry)}</span>
                </td>
                <td className="small ac-muted">{entry.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
