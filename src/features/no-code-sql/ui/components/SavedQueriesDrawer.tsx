import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type SavedQueryItem = {
  id: string;
  title: string;
  updatedAt: string;
  shared?: boolean;
};

type SavedQueriesGroups = {
  shared: SavedQueryItem[];
  mine: SavedQueryItem[];
  recent: SavedQueryItem[];
};

// ---- Mock data (replace later with real data) ----
const MOCK_SAVED: SavedQueriesGroups = {
  shared: [
    { id: "sq_shared_1", title: "PT Providers in KY (Summary)", updatedAt: "2025-12-21", shared: true },
    { id: "sq_shared_2", title: "Top Referrers by Facility", updatedAt: "2025-12-18", shared: true },
  ],
  mine: [
    { id: "sq_mine_1", title: "My Claims Paid Amount (YTD)", updatedAt: "2025-12-20" },
    { id: "sq_mine_2", title: "Member Eligibility Gaps", updatedAt: "2025-12-16" },
  ],
  recent: [{ id: "sq_recent_1", title: "PT Providers by ZIP3", updatedAt: "2025-12-22" }],
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

/** ✅ 1) Mini rail that lives INSIDE the page layout (not fixed to viewport) */
export function SavedQueriesRail({
  onOpen,
  onNew,
}: {
  onOpen: () => void;
  onNew: () => void;
}) {
  return (
    <div
      // IMPORTANT: this is now in-flow + sticky, so it won’t appear left of your app nav
      style={{
        width: 44,
        position: "sticky",
        top: 12,
        alignSelf: "flex-start",
        height: "calc(100vh - 120px)", // tweak as needed for your header/footer
        zIndex: 1,
        borderRight: "1px solid rgba(0,0,0,0.12)",
        background: "#fff",
      }}
      className="d-flex flex-column align-items-center py-2 gap-2 shadow-sm rounded"
      aria-label="Saved Queries rail"
    >
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        title="Saved Queries"
        onClick={onOpen}
        style={{ width: 34, height: 34, padding: 0 }}
      >
        <i className="fa fa-folder-open" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        title="New Query"
        onClick={onNew}
        style={{ width: 34, height: 34, padding: 0 }}
      >
        <i className="fa fa-plus" aria-hidden="true" />
      </button>

      <div className="flex-grow-1" />

      {/* Open affordance (points right because drawer opens right) */}
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        title="Open Saved Queries"
        onClick={onOpen}
        style={{ width: 34, height: 34, padding: 0 }}
      >
        <i className="fa fa-chevron-right" aria-hidden="true" />
      </button>
    </div>
  );
}

/** ✅ 2) Offcanvas that slides in from the LEFT (opens to the RIGHT) */
export function SavedQueriesOffcanvas({
  open,
  onClose,
  selectedQueryId,
  onSelectQuery,
  width = 640,
}: {
  open: boolean;
  onClose: () => void;
  selectedQueryId?: string;
  onSelectQuery: (id: string) => void;
  width?: number;
}) {
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState({ shared: true, mine: true, recent: true });

  // ESC closes + body scroll lock (matches Crosswalk drawer behavior)
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
      shared: f(MOCK_SAVED.shared),
      mine: f(MOCK_SAVED.mine),
      recent: f(MOCK_SAVED.recent),
    };
  }, [term]);

  if (!open) return null;

  const onNew = () => console.info("New query (mock)");
  const onImport = () => console.info("Import query (mock)");

  return createPortal(
    <>
      {/* ✅ Explicit fixed/inset + z-index so it is NEVER “behind” */}
      <div
        className="offcanvas-backdrop fade show"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1040,
          background: "rgba(0,0,0,0.5)",
          opacity: 1,
        }}
      />

      <div
        className="offcanvas offcanvas-start show"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width,
          zIndex: 1045,
          background: "#fff", // ✅ ensure opaque
          boxShadow: "0 0.5rem 1rem rgba(0,0,0,0.15)",
        }}
      >
        <div className="offcanvas-header border-bottom">
          <div>
            <h5 className="offcanvas-title mb-0">Saved Queries</h5>
            <div className="text-muted small">Shared • Mine • Recent</div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onImport}>
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
            onChange={(e) => setSearch(e.target.value)}
          />

          <DrawerGroup
            title={`Shared (${filtered.shared.length})`}
            open={openGroups.shared}
            onToggle={() => setOpenGroups((p) => ({ ...p, shared: !p.shared }))}
          >
            <div className="list-group list-group-flush">
              {filtered.shared.length === 0 ? (
                <div className="text-muted small px-2 py-2">No shared queries.</div>
              ) : (
                filtered.shared.map((q) => {
                  const active = q.id === selectedQueryId;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={"list-group-item list-group-item-action py-2 " + (active ? "active" : "")}
                      onClick={() => onSelectQuery(q.id)}
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
                })
              )}
            </div>
          </DrawerGroup>

          <DrawerGroup
            title={`My Queries (${filtered.mine.length})`}
            open={openGroups.mine}
            onToggle={() => setOpenGroups((p) => ({ ...p, mine: !p.mine }))}
          >
            <div className="list-group list-group-flush">
              {filtered.mine.length === 0 ? (
                <div className="text-muted small px-2 py-2">No personal queries yet.</div>
              ) : (
                filtered.mine.map((q) => {
                  const active = q.id === selectedQueryId;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={"list-group-item list-group-item-action py-2 " + (active ? "active" : "")}
                      onClick={() => onSelectQuery(q.id)}
                    >
                      <div className="fw-semibold text-truncate">{q.title}</div>
                      <small className={active ? "text-white-50" : "text-muted"}>
                        Updated {q.updatedAt}
                      </small>
                    </button>
                  );
                })
              )}
            </div>
          </DrawerGroup>

          <DrawerGroup
            title={`Recent (${filtered.recent.length})`}
            open={openGroups.recent}
            onToggle={() => setOpenGroups((p) => ({ ...p, recent: !p.recent }))}
          >
            <div className="list-group list-group-flush">
              {filtered.recent.length === 0 ? (
                <div className="text-muted small px-2 py-2">No recent queries.</div>
              ) : (
                filtered.recent.map((q) => {
                  const active = q.id === selectedQueryId;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={"list-group-item list-group-item-action py-2 " + (active ? "active" : "")}
                      onClick={() => onSelectQuery(q.id)}
                    >
                      <div className="fw-semibold text-truncate">{q.title}</div>
                      <small className={active ? "text-white-50" : "text-muted"}>
                        Updated {q.updatedAt}
                      </small>
                    </button>
                  );
                })
              )}
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

/**
 * ✅ Wrapper that preserves your existing NoCodeQueryPage usage:
 * <SavedQueriesDrawer collapsed={drawerCollapsed} onToggleCollapsed=... />
 *
 * Interpretation:
 *  - collapsed === true  => offcanvas closed
 *  - collapsed === false => offcanvas open
 */
export function SavedQueriesDrawer({
  collapsed,
  onToggleCollapsed,
  selectedQueryId,
  onSelectQuery,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  selectedQueryId?: string;
  onSelectQuery: (id: string) => void;
}) {
  const open = !collapsed;

  return (
    <>
      <SavedQueriesRail
        onOpen={() => {
          if (!open) onToggleCollapsed();
        }}
        onNew={() => {
          if (!open) onToggleCollapsed();
          console.info("New query (mock)");
        }}
      />

      <SavedQueriesOffcanvas
        open={open}
        onClose={onToggleCollapsed}
        selectedQueryId={selectedQueryId}
        onSelectQuery={onSelectQuery}
      />
    </>
  );
}