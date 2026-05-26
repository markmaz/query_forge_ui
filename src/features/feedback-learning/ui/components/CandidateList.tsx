import type { FeedbackLearningCandidateRow } from "../../model/types";

type Props = {
  rows: FeedbackLearningCandidateRow[];
  selectedIds: number[];
  onToggleSelected: (candidateId: number) => void;
  onToggleAll: () => void;
  onView: (candidateId: number) => void;
  onApprove: (candidateId: number) => void;
  onReject: (candidateId: number) => void;
};

function badgeClass(status: string): string {
  if (status === "approved" || status === "auto_applied") return "badge text-bg-success";
  if (status === "rejected") return "badge text-bg-danger";
  if (status === "needs_review") return "badge text-bg-warning";
  return "badge text-bg-secondary";
}

function riskClass(level: string): string {
  if (level === "low") return "badge text-bg-success";
  if (level === "high") return "badge text-bg-danger";
  return "badge text-bg-warning";
}

function displayKey(row: FeedbackLearningCandidateRow): string {
  return row.concept_key ?? row.domain_key ?? "—";
}

export function CandidateList({
  rows,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  onView,
  onApprove,
  onReject,
}: Props) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            <th style={{ width: 48 }}>
              <input
                type="checkbox"
                aria-label="Select all candidates"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
            <th>ID</th>
            <th>Status</th>
            <th>Risk</th>
            <th>Target</th>
            <th>Key</th>
            <th>Change</th>
            <th>Evidence</th>
            <th>Confidence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-muted">
                No feedback-learning candidates match the current filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const selected = selectedIds.includes(row.id);
              return (
                <tr key={row.id} className={selected ? "sa-run-row is-selected" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select candidate ${row.id}`}
                      checked={selected}
                      onChange={() => onToggleSelected(row.id)}
                    />
                  </td>
                  <td>{row.id}</td>
                  <td>
                    <span className={badgeClass(row.governance_status)}>
                      {row.governance_status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    <span className={riskClass(row.risk_level)}>{row.risk_level}</span>
                  </td>
                  <td>{row.target_type.replaceAll("_", " ")}</td>
                  <td>{displayKey(row)}</td>
                  <td>{row.change_type}</td>
                  <td>{row.evidence_count}</td>
                  <td>{Math.round(row.confidence * 100)}%</td>
                  <td>
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => onView(row.id)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => onApprove(row.id)}
                        disabled={row.governance_status === "approved"}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onReject(row.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
