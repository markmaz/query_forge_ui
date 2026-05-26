// src/features/query-forge/ui/components/home/RecentQueriesWidget.tsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hydrateQueryTree } from "../../../../shared/services/queryTreeApi";

export type RecentQueryRow = {
  id: string;
  title: string;
  status?: "draft" | "saved" | "shared" | "workflow" | "skill" | "forge_match" | "active" | "paused" | "error";
  updatedAtIso?: string;
  ownerLabel?: string | null;
};

export type RecentQueriesWidgetProps = {
  rows?: RecentQueryRow[];
  onOpen: (id: string) => void;
  onPreview?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onViewAll?: () => void;
  loading?: boolean;
  error?: string | null;
};

function formatUpdated(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusBadge(status?: RecentQueryRow["status"]) {
  const s = status ?? "saved";
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "text-bg-warning" },
    saved: { label: "Saved", cls: "text-bg-success" },
    shared: { label: "Shared", cls: "text-bg-primary" },
    workflow: { label: "Workflow", cls: "text-bg-danger" },
    skill: { label: "Skill", cls: "text-bg-info" },
    forge_match: { label: "Forge Match", cls: "text-bg-dark" },
    active: { label: "Active", cls: "text-bg-success" },
    paused: { label: "Paused", cls: "text-bg-secondary" },
    error: { label: "Needs attention", cls: "text-bg-danger" },
  };
  const hit = map[s] ?? map.saved;
  return <span className={`badge ${hit.cls}`}>{hit.label}</span>;
}

const RecentQueriesWidget: React.FC<RecentQueriesWidgetProps> = ({
  rows,
  onOpen,
  onPreview,
  onDuplicate,
  onDelete,
  onViewAll,
  loading,
  error,
}) => {
  const shouldFetch = rows == null;
  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
    enabled: shouldFetch,
  });

  const resolvedRows = useMemo<RecentQueryRow[]>(() => {
    if (rows) return rows;
    const recentItems = queryTreeQuery.data?.recent ?? [];
    return recentItems.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAtIso: item.updatedAt ?? undefined,
      status: "saved",
    }));
  }, [rows, queryTreeQuery.data]);

  const resolvedLoading = loading ?? (shouldFetch ? queryTreeQuery.isLoading : false);
  const resolvedError =
    error ?? (shouldFetch && queryTreeQuery.isError ? "Failed to load recent queries." : null);

  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body d-flex align-items-center justify-content-between">
        <div className="fw-semibold">Continue where you left off</div>
        <button className="btn btn-link btn-sm text-decoration-none" type="button" onClick={onViewAll}>
          View all
        </button>
      </div>

      <div className="card-body p-0">
        {resolvedLoading ? (
          <div className="p-3 text-muted">Loading recent queries…</div>
        ) : resolvedError ? (
          <div className="p-3 text-danger">{resolvedError}</div>
        ) : resolvedRows.length === 0 ? (
          <div className="p-3 text-muted">No recent queries yet. Start a new one to see it here.</div>
        ) : (
          <div className="list-group list-group-flush">
            {resolvedRows.slice(0, 6).map((q) => (
              <div key={q.id} className="list-group-item d-flex gap-3 align-items-center">
                <div className="flex-shrink-0">{statusBadge(q.status)}</div>

                <div className="flex-grow-1">
                  <div className="fw-semibold">{q.title}</div>
                  <div className="small text-muted">
                    Updated {formatUpdated(q.updatedAtIso)}
                    {q.ownerLabel ? ` • ${q.ownerLabel}` : ""}
                  </div>
                </div>

                <div className="d-flex gap-2">
                  {onPreview ? (
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => onPreview(q.id)} type="button">
                      Preview
                    </button>
                  ) : null}
                  {onDuplicate ? (
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => onDuplicate(q.id)} type="button">
                      Duplicate
                    </button>
                  ) : null}
                  <button className="btn btn-primary btn-sm" onClick={() => onOpen(q.id)} type="button">
                    Open
                  </button>
                  {onDelete ? (
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => onDelete(q.id)}
                      type="button"
                      aria-label="Delete"
                      title="Delete"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentQueriesWidget;
