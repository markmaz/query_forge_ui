import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useDeletePromptFeedback,
  usePromptFeedbackList,
} from "@/features/system-admin/hooks";
import type { PromptFeedbackRow, PromptFeedbackVote } from "@/features/system-admin/types";
import "../systemAdmin.css";

type VoteFilter = "all" | PromptFeedbackVote;

const LIMIT_OPTIONS = [25, 50, 100, 200] as const;

function formatTimestamp(value: string | null): string {
  if (!value) return "—";

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toLocaleString();
  }

  const normalized = value.replace(" ", "T").replace(",", ".");
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }

  return value;
}

function truncateId(value: string | null): string {
  if (!value) return "—";
  return value.length > 10 ? `${value.slice(0, 10)}…` : value;
}

function truncateText(value: string | null, maxLength: number): string {
  if (!value) return "—";
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}

export default function AdminPromptFeedbackPage() {
  const [vote, setVote] = useState<VoteFilter>("all");
  const [userId, setUserId] = useState("");
  const [traceId, setTraceId] = useState("");
  const [includePayload, setIncludePayload] = useState(false);
  const [limit, setLimit] = useState<number>(25);
  const [offset, setOffset] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<PromptFeedbackRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<PromptFeedbackRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const params = useMemo(() => {
    const next: {
      limit: number;
      offset: number;
      include_payload: boolean;
      vote?: PromptFeedbackVote;
      user_id?: string;
      trace_id?: string;
    } = {
      limit,
      offset,
      include_payload: includePayload,
    };

    const trimmedUser = userId.trim();
    const trimmedTrace = traceId.trim();

    if (vote !== "all") next.vote = vote;
    if (trimmedUser) next.user_id = trimmedUser;
    if (trimmedTrace) next.trace_id = trimmedTrace;
    return next;
  }, [includePayload, limit, offset, traceId, userId, vote]);

  const listQuery = usePromptFeedbackList(params);
  const deleteMutation = useDeletePromptFeedback();

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const canGoPrevious = offset > 0;
  const canGoNext = offset + limit < total;
  const pageStart = total > 0 ? offset + 1 : 0;
  const pageEnd = total > 0 ? Math.min(offset + rows.length, total) : 0;

  const copyValue = async (value: string | null, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  const handleFilterChange = (updater: () => void) => {
    updater();
    setOffset(0);
    setActionError(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setActionError(null);
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Prompt feedback deleted.");
        setDeleteTarget(null);
        void listQuery.refetch();
      },
      onError: (error) => {
        setActionError(toErrorMessage(error, "Unable to delete prompt feedback."));
      },
    });
  };

  const clearFilters = () => {
    setVote("all");
    setUserId("");
    setTraceId("");
    setIncludePayload(false);
    setLimit(25);
    setOffset(0);
    setActionError(null);
  };

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="sa-loading">
        <span className="sa-spinner lg" />
        Loading prompt feedback…
      </div>
    );
  }

  const queryErrorMessage = listQuery.isError
    ? toErrorMessage(listQuery.error, "Unable to load prompt feedback.")
    : null;

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Prompt Feedback</h1>
          <p className="sa-page-subtitle">
            {total} record{total === 1 ? "" : "s"}
          </p>
        </div>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => void listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          <i className="fa fa-refresh" /> Refresh
        </button>
      </div>

      {(queryErrorMessage || actionError) && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>{queryErrorMessage ?? actionError}</span>
          {queryErrorMessage && (
            <button className="btn btn-sm btn-outline-danger" onClick={() => void listQuery.refetch()}>
              Retry
            </button>
          )}
        </div>
      )}

      <div className="sa-toolbar">
        <label className="sa-field" style={{ marginBottom: 0 }}>
          <span>Vote</span>
          <select
            className="form-select form-select-sm"
            aria-label="Vote"
            value={vote}
            onChange={(event) =>
              handleFilterChange(() => setVote(event.target.value as VoteFilter))
            }
          >
            <option value="all">All</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
        </label>

        <label className="sa-field" style={{ marginBottom: 0 }}>
          <span>User ID</span>
          <input
            className="form-control form-control-sm"
            aria-label="User ID"
            value={userId}
            onChange={(event) => handleFilterChange(() => setUserId(event.target.value))}
            placeholder="Filter by user"
          />
        </label>

        <label className="sa-field" style={{ marginBottom: 0 }}>
          <span>Trace ID</span>
          <input
            className="form-control form-control-sm"
            aria-label="Trace ID"
            value={traceId}
            onChange={(event) => handleFilterChange(() => setTraceId(event.target.value))}
            placeholder="Filter by trace"
          />
        </label>

        <label className="sa-field" style={{ marginBottom: 0 }}>
          <span>Limit</span>
          <select
            className="form-select form-select-sm"
            aria-label="Limit"
            value={limit}
            onChange={(event) =>
              handleFilterChange(() => setLimit(Number(event.target.value)))
            }
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="form-check" style={{ marginBottom: 0 }}>
          <input
            className="form-check-input"
            type="checkbox"
            checked={includePayload}
            onChange={(event) =>
              handleFilterChange(() => setIncludePayload(event.target.checked))
            }
            aria-label="Include payload"
          />
          <span className="form-check-label">Include payload</span>
        </label>

        <button className="btn btn-sm btn-light" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          Showing {pageStart}-{pageEnd} of {total}
        </span>
        <div className="d-flex gap-2 align-items-center">
          {listQuery.isFetching && (
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              <span className="sa-spinner" style={{ marginRight: 6 }} />
              Loading…
            </span>
          )}
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            disabled={!canGoPrevious || listQuery.isFetching}
          >
            Previous
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={!canGoNext || listQuery.isFetching}
          >
            Next
          </button>
        </div>
      </div>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>id</th>
              <th>vote</th>
              <th>user_id</th>
              <th>trace_id</th>
              <th>prompt_text</th>
              <th>created_at</th>
              <th>updated_at</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="expandable" onClick={() => setSelectedRow(row)}>
                <td>{row.id}</td>
                <td>
                  {row.vote === "up" ? (
                    <span className="sa-vote sa-vote-up" title="Upvote">
                      <i className="fa fa-thumbs-up" /> up
                    </span>
                  ) : (
                    <span className="sa-vote sa-vote-down" title="Downvote">
                      <i className="fa fa-thumbs-down" /> down
                    </span>
                  )}
                </td>
                <td className="sa-id-cell" title={row.user_id ?? ""}>
                  <span className="sa-truncate-id">{truncateId(row.user_id)}</span>
                  {row.user_id && (
                    <button
                      className="sa-copy-btn sa-inline-copy"
                      aria-label={`Copy user id ${row.id}`}
                      title="Copy full user ID"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copyValue(row.user_id, "User ID");
                      }}
                    >
                      <i className="fa fa-copy" />
                    </button>
                  )}
                </td>
                <td className="sa-id-cell" title={row.trace_id ?? ""}>
                  <span className="sa-truncate-id">{truncateId(row.trace_id)}</span>
                  {row.trace_id && (
                    <button
                      className="sa-copy-btn sa-inline-copy"
                      aria-label={`Copy trace id ${row.id}`}
                      title="Copy full trace ID"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copyValue(row.trace_id, "Trace ID");
                      }}
                    >
                      <i className="fa fa-copy" />
                    </button>
                  )}
                </td>
                <td className="sa-id-cell" title={row.prompt_text ?? ""}>
                  <span className="sa-truncate-prompt">{truncateText(row.prompt_text, 20)}</span>
                  {row.prompt_text && (
                    <button
                      className="sa-copy-btn sa-inline-copy"
                      aria-label={`Copy prompt text ${row.id}`}
                      title="Copy full prompt text"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copyValue(row.prompt_text, "Prompt text");
                      }}
                    >
                      <i className="fa fa-copy" />
                    </button>
                  )}
                </td>
                <td>{formatTimestamp(row.created_at)}</td>
                <td>{formatTimestamp(row.updated_at)}</td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    aria-label={`Delete ${row.id}`}
                    title={`Delete feedback ${row.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActionError(null);
                      setDeleteTarget(row);
                    }}
                  >
                    <i className="fa fa-trash" />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 28, color: "#6b7280" }}>
                  No prompt feedback found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <>
          <div className="sa-drawer-backdrop" onClick={() => setSelectedRow(null)} />
          <aside className="sa-drawer" role="dialog" aria-label={`Prompt Feedback ${selectedRow.id}`}>
            <div className="sa-drawer-header">
              <div className="sa-drawer-header-vote">
                <span
                  className={`sa-feedback-icon ${selectedRow.vote === "up" ? "sa-vote-up" : "sa-vote-down"}`}
                  title={selectedRow.vote === "up" ? "Upvote" : "Downvote"}
                >
                  <i className={`fa ${selectedRow.vote === "up" ? "fa-thumbs-up" : "fa-thumbs-down"}`} />
                </span>
                <div className="sa-feedback-header-copy">
                  <div className="sa-feedback-title">Vote Type</div>
                  <div className={`sa-feedback-vote ${selectedRow.vote === "up" ? "sa-vote-up" : "sa-vote-down"}`}>
                    {selectedRow.vote === "up" ? "Upvote" : "Downvote"}
                  </div>
                </div>
              </div>
              <h2 className="sa-drawer-header-title">Prompt Feedback #{selectedRow.id}</h2>
              <button className="btn btn-sm btn-light" onClick={() => setSelectedRow(null)} aria-label="Close details">
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="sa-drawer-body">
              <div className="sa-field">
                <label>Prompt Text</label>
                <div className="sa-inset-box sa-hover-copy-target sa-inset-box-copy" title={selectedRow.prompt_text ?? ""}>
                  <span>{selectedRow.prompt_text ?? "—"}</span>
                  {selectedRow.prompt_text && (
                    <button
                      className="sa-copy-btn sa-inline-copy"
                      title="Copy full prompt text"
                      onClick={() => void copyValue(selectedRow.prompt_text, "Prompt text")}
                    >
                      <i className="fa fa-copy" />
                    </button>
                  )}
                </div>
              </div>

              <div className="sa-field">
                <label>Normalized Prompt</label>
                <div className="sa-inset-box" title={selectedRow.normalized_prompt ?? ""}>
                  {selectedRow.normalized_prompt ?? "—"}
                </div>
              </div>

              <div className="sa-field">
                <label>User ID</label>
                <div className="value sa-hover-copy-target" title={selectedRow.user_id ?? ""}>
                  <span>{selectedRow.user_id ?? "—"}</span>
                  {selectedRow.user_id && (
                    <button
                      className="sa-copy-btn sa-inline-copy"
                      title="Copy full user ID"
                      onClick={() => void copyValue(selectedRow.user_id, "User ID")}
                    >
                      <i className="fa fa-copy" />
                    </button>
                  )}
                </div>
              </div>

              <div className="sa-field">
                <label>Trace ID</label>
                <div className="value sa-hover-copy-target" title={selectedRow.trace_id ?? ""}>
                  <span>{selectedRow.trace_id ?? "—"}</span>
                  {selectedRow.trace_id && (
                    <button
                      className="sa-copy-btn sa-inline-copy"
                      title="Copy full trace ID"
                      onClick={() => void copyValue(selectedRow.trace_id, "Trace ID")}
                    >
                      <i className="fa fa-copy" />
                    </button>
                  )}
                </div>
              </div>

              <div className="sa-detail-meta sa-detail-meta-gap-top">
                <div className="sa-detail-meta-item">
                  <span className="label">Created At</span>{" "}
                  <span className="value">{formatTimestamp(selectedRow.created_at)}</span>
                </div>
                <div className="sa-detail-meta-item">
                  <span className="label">Updated At</span>{" "}
                  <span className="value">{formatTimestamp(selectedRow.updated_at)}</span>
                </div>
              </div>

              {selectedRow.payload && (
                <div className="sa-field">
                  <label>Payload</label>
                  <pre className="sa-json-block">{JSON.stringify(selectedRow.payload, null, 2)}</pre>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {deleteTarget && (
        <div className="sa-dialog-backdrop">
          <div className="sa-dialog" role="dialog" aria-label="Delete Prompt Feedback">
            <div className="sa-dialog-header">
              <span>Delete Prompt Feedback</span>
              <button
                className="btn btn-sm btn-light"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
              >
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="sa-dialog-body">
              Delete prompt feedback record <strong>{deleteTarget.id}</strong>? This action cannot be
              undone.
            </div>
            <div className="sa-dialog-footer">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <span className="sa-spinner" style={{ marginRight: 6 }} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
