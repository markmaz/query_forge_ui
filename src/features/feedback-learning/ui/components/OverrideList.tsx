import type { FeedbackLearningOverrideRow } from "../../model/types";

type Props = {
  title: string;
  rows: FeedbackLearningOverrideRow[];
  kind: "semantic" | "domain";
  onDeactivate: (overrideId: number, kind: "semantic" | "domain") => void;
};

function keyLabel(row: FeedbackLearningOverrideRow): string {
  return row.concept_key ?? row.domain_key ?? "—";
}

export function OverrideList({ title, rows, kind, onDeactivate }: Props) {
  return (
    <section className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">{title}</h3>
        <span className="badge text-bg-secondary">{rows.length}</span>
      </div>
      <div className="sa-table-wrap mb-0">
        <table className="sa-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Key</th>
              <th>Override</th>
              <th>Approved By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted">
                  No active overrides.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${kind}-${row.id}`}>
                  <td>{row.id}</td>
                  <td>{row.status}</td>
                  <td>{keyLabel(row)}</td>
                  <td>
                    <div className="small">
                      <div>{row.override_type ?? "—"}</div>
                      <div className="text-muted">{row.override_key ?? "—"}</div>
                    </div>
                  </td>
                  <td>{row.approved_by ?? "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onDeactivate(row.id, kind)}
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
