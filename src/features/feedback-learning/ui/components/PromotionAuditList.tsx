import type { FeedbackLearningPromotionAuditRow } from "../../model/types";

type Props = {
  rows: FeedbackLearningPromotionAuditRow[];
};

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  return value;
}

export function PromotionAuditList({ rows }: Props) {
  return (
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Source</th>
            <th>Target</th>
            <th>Action</th>
            <th>Promoted By</th>
            <th>Promoted At</th>
            <th>Retries</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-muted">
                No promotion audits match the current filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.promotion_status ?? "—"}</td>
                <td>
                  <div>{row.source_type ?? "—"}</div>
                  <div className="text-muted">#{row.source_id ?? "—"}</div>
                </td>
                <td>
                  <div>{row.target_table ?? "—"}</div>
                  <div className="text-muted">{row.target_record_key ?? "—"}</div>
                </td>
                <td>{row.promotion_action ?? "—"}</td>
                <td>{row.promoted_by ?? "—"}</td>
                <td>{formatTimestamp(row.promoted_at)}</td>
                <td>{row.retry_count ?? 0}</td>
                <td>{row.error_message ?? row.notes ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
