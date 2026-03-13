import type { ForgeMatchSessionListRow, ForgeMatchSessionListStatus } from "../types";

type Props = {
  rows: ForgeMatchSessionListRow[];
  total: number;
  page: number;
  pageSize: number;
  status: ForgeMatchSessionListStatus | "all";
  query: string;
  selectedSessionId: string | null;
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onStatusChange: (status: ForgeMatchSessionListStatus | "all") => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onOpen: (sessionId: string) => void;
};

function statusBadgeClass(status: ForgeMatchSessionListStatus): string {
  if (status === "analyzed") return "bg-success-subtle text-success-emphasis";
  if (status === "analyzing") return "bg-warning-subtle text-warning-emphasis";
  return "bg-secondary-subtle text-secondary-emphasis";
}

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

function SessionRowsSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={`skeleton-${index}`}>
          <td colSpan={8}>
            <div className="placeholder-glow">
              <span className="placeholder col-12" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

export default function ForgeMatchSessionsPanel({
  rows,
  total,
  page,
  pageSize,
  status,
  query,
  selectedSessionId,
  isLoading,
  isFetching,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onQueryChange,
  onRefresh,
  onOpen,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 0) / Math.max(pageSize, 1)));

  return (
    <section className="fm-card fm-sessions-panel" aria-label="ForgeMatch sessions list">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">Sessions</h2>
          <p className="fm-card-subtitle">Browse existing mapping sessions and open one in the review workspace.</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onRefresh}>
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="row g-2 align-items-end mb-2">
        <div className="col-12">
          <label htmlFor="forge-match-sessions-search" className="form-label">Search</label>
          <input
            id="forge-match-sessions-search"
            className="form-control form-control-sm"
            placeholder="Search filename or creator"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <div className="col-6">
          <label htmlFor="forge-match-sessions-status" className="form-label">Status</label>
          <select
            id="forge-match-sessions-status"
            className="form-select form-select-sm"
            value={status}
            onChange={(event) => onStatusChange(event.target.value as ForgeMatchSessionListStatus | "all")}
          >
            <option value="all">All</option>
            <option value="uploaded">Uploaded</option>
            <option value="analyzing">Analyzing</option>
            <option value="analyzed">Analyzed</option>
          </select>
        </div>
        <div className="col-6">
          <label htmlFor="forge-match-sessions-page-size" className="form-label">Page Size</label>
          <select
            id="forge-match-sessions-page-size"
            className="form-select form-select-sm"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div className="table-responsive fm-sessions-table-wrap">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Source Fields</th>
              <th>Results</th>
              <th>Accepted</th>
              <th>Manual</th>
              <th>Actions</th>
            </tr>
          </thead>
          {isLoading ? (
            <SessionRowsSkeleton />
          ) : (
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted text-center py-3">No sessions found.</td>
                </tr>
              ) : (
                rows.map((session) => {
                  const active = session.id === selectedSessionId;
                  return (
                    <tr
                      key={session.id}
                      className={active ? "table-primary" : ""}
                      onClick={() => onOpen(session.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpen(session.id);
                        }
                      }}
                    >
                      <td>
                        <FilenameCell filename={session.uploaded_filename} fileType={session.file_type} />
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${statusBadgeClass(session.status)}`}>{session.status}</span>
                      </td>
                      <td>{formatDateTime(session.created_at)}</td>
                      <td>{session.source_record_count ?? 0}</td>
                      <td>{session.result_count ?? 0}</td>
                      <td>{session.accepted_count ?? 0}</td>
                      <td>{session.manually_mapped_count ?? 0}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpen(session.id);
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          )}
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-2 gap-2">
        <small className="text-muted">
          Page {page} of {totalPages} ({total.toLocaleString()} total)
        </small>

        <div className="btn-group btn-group-sm" role="group" aria-label="Sessions pagination">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
