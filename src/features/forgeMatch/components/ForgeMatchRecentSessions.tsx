import type { ForgeMatchSessionListRow } from "../types";

type Props = {
  rows: ForgeMatchSessionListRow[];
  isLoading?: boolean;
  onOpen: (sessionId: string) => void;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

function FilenameCell({
  filename,
  fileType,
}: {
  filename: string;
  fileType: string | null | undefined;
}) {
  return (
    <div className="list-group list-group-flush border rounded fm-filename-group">
      <div className="list-group-item py-2">
        <div className="fw-semibold text-truncate">{filename}</div>
        <div className="small text-muted text-uppercase">{fileType ?? "-"}</div>
      </div>
    </div>
  );
}

export default function ForgeMatchRecentSessions({ rows, isLoading, onOpen }: Props) {
  return (
    <section className="fm-card" aria-label="Recent ForgeMatch sessions">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">Recent Sessions</h2>
          <p className="fm-card-subtitle">Open an existing session to continue review.</p>
        </div>
      </div>

      <div className="table-responsive fm-recent-sessions-table-wrap">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Status</th>
              <th>Created</th>
              <th>Source Fields</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center text-muted py-3">Loading sessions...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-muted py-3">No sessions available.</td>
              </tr>
            ) : (
              rows.slice(0, 6).map((row) => (
                <tr key={row.id}>
                  <td>
                    <FilenameCell filename={row.uploaded_filename} fileType={row.file_type} />
                  </td>
                  <td><span className="text-capitalize">{row.status}</span></td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.source_record_count ?? 0}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpen(row.id)}>
                      Open
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
