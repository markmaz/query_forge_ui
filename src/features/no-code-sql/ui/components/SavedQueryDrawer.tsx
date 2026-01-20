import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export type SavedQueryItem = {
  id: string;
  title: string;
  updatedAt: string;
  shared?: boolean;
};

export type SavedQueriesGroups = {
  shared: SavedQueryItem[];
  mine: SavedQueryItem[];
  recent: SavedQueryItem[];
};

function DrawerGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <button
        type="button"
        className="btn btn-sm btn-link text-decoration-none px-0"
        onClick={onToggle}
      >
        <span className="me-1">{open ? "▾" : "▸"}</span>
        <span className="fw-semibold">{title}</span>
      </button>
      {open ? children : null}
    </div>
  );
}

export function SavedQueriesDrawer({
  open,
  onClose,

  // data + selection
  saved,
  selectedQueryId,
  onSelectQuery,

  // actions
  onNew,
  onImport,

  // UI state
  search,
  onChangeSearch,
  openGroups,
  onToggleGroup,

  width = 640,
}: {
  open: boolean;
  onClose: () => void;

  saved: SavedQueriesGroups;
  selectedQueryId?: string;
  onSelectQuery: (id: string, group: "shared" | "mine" | "recent") => void;

  onNew: () => void;
  onImport: () => void;

  search: string;
  onChangeSearch: (v: string) => void;

  openGroups: { shared: boolean; mine: boolean; recent: boolean };
  onToggleGroup: (k: "shared" | "mine" | "recent") => void;

  width?: number;
}) {
  // ✅ Hooks ALWAYS run
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const f = (items: SavedQueryItem[]) =>
      !term ? items : items.filter((x) => x.title.toLowerCase().includes(term));

    return {
      shared: f(saved.shared),
      mine: f(saved.mine),
      recent: f(saved.recent),
    };
  }, [saved, term]);

  // ✅ Early return AFTER hooks
  if (!open) return null;

  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={onClose} />

      <div
        className="offcanvas offcanvas-end show"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{ position: "fixed", width }}
      >
        <div className="offcanvas-header border-bottom">
          <div>
            <h5 className="offcanvas-title mb-0">Saved Queries</h5>
            <div className="text-muted small">Shared • Mine • Recent</div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onImport}
            >
              Import
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onNew}>
              + New
            </button>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
        </div>

        <div className="offcanvas-body">
          <input
            type="search"
            className="form-control form-control-sm mb-3"
            placeholder="Search saved queries…"
            value={search}
            onChange={(e) => onChangeSearch(e.target.value)}
          />

          <DrawerGroup
            title={`Shared (${filtered.shared.length})`}
            open={openGroups.shared}
            onToggle={() => onToggleGroup("shared")}
          >
            <div className="list-group list-group-flush">
              {filtered.shared.map((q) => {
                const active = q.id === selectedQueryId;
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={
                      "list-group-item list-group-item-action py-2 " +
                      (active ? "active" : "")
                    }
                    onClick={() => onSelectQuery(q.id, "shared")}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="text-truncate" style={{ maxWidth: "85%" }}>
                        <div className="fw-semibold text-truncate">{q.title}</div>
                        <small className={active ? "text-white-50" : "text-muted"}>
                          Updated {q.updatedAt}
                        </small>
                      </div>
                      <span className={"badge " + (active ? "bg-light text-dark" : "bg-light text-secondary")}>
                        Shared
                      </span>
                    </div>
                  </button>
                );
              })}
              {filtered.shared.length === 0 ? (
                <div className="text-muted small px-2 py-2">No shared queries.</div>
              ) : null}
            </div>
          </DrawerGroup>

          <DrawerGroup
            title={`My Queries (${filtered.mine.length})`}
            open={openGroups.mine}
            onToggle={() => onToggleGroup("mine")}
          >
            <div className="list-group list-group-flush">
              {filtered.mine.map((q) => {
                const active = q.id === selectedQueryId;
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={
                      "list-group-item list-group-item-action py-2 " +
                      (active ? "active" : "")
                    }
                    onClick={() => onSelectQuery(q.id, "mine")}
                  >
                    <div className="fw-semibold text-truncate">{q.title}</div>
                    <small className={active ? "text-white-50" : "text-muted"}>
                      Updated {q.updatedAt}
                    </small>
                  </button>
                );
              })}
              {filtered.mine.length === 0 ? (
                <div className="text-muted small px-2 py-2">No personal queries yet.</div>
              ) : null}
            </div>
          </DrawerGroup>

          <DrawerGroup
            title={`Recent (${filtered.recent.length})`}
            open={openGroups.recent}
            onToggle={() => onToggleGroup("recent")}
          >
            <div className="list-group list-group-flush">
              {filtered.recent.map((q) => {
                const active = q.id === selectedQueryId;
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={
                      "list-group-item list-group-item-action py-2 " +
                      (active ? "active" : "")
                    }
                    onClick={() => onSelectQuery(q.id, "recent")}
                  >
                    <div className="fw-semibold text-truncate">{q.title}</div>
                    <small className={active ? "text-white-50" : "text-muted"}>
                      Updated {q.updatedAt}
                    </small>
                  </button>
                );
              })}
              {filtered.recent.length === 0 ? (
                <div className="text-muted small px-2 py-2">No recent queries.</div>
              ) : null}
            </div>
          </DrawerGroup>
        </div>

        <div className="border-top p-3 d-flex justify-content-end">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}