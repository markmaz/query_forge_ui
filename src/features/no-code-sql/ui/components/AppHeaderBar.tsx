// src/features/nocode-query/ui/components/AppHeaderBar.tsx
import React, { useEffect, useRef, useState } from "react";

export type QueryPathStep = {
  key: string;
  label: string;
  status: "todo" | "active" | "done";
};

type Props = {
  queryPath: QueryPathStep[];

  // NEW: query name (displayed + editable)
  queryName: string;
  queryNameDirty?: boolean; // optional visual indicator
  queryIsSaved?: boolean;
  onRenameQuery: (nextName: string) => void;
  onNameBlurSave?: () => void;

  onRestoreLayout?: () => void;
  onRestoreAll?: () => void;
  hiddenCount?: number;

  // Save button should open a dialog in the page
  onSave?: () => void;

  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onNewQuery?: () => void;
};

export const AppHeaderBar: React.FC<Props> = ({
  queryPath,
  queryName,
  queryNameDirty = false,
  queryIsSaved = false,
  onRenameQuery,
  onNameBlurSave,

  onRestoreAll,
  hiddenCount = 0,
  onSave,
  onExpandAll,
  onCollapseAll,
  onNewQuery,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(queryName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressBlurRef = useRef(false);

  // keep draft in sync when queryName changes from outside (open query, etc.)
  useEffect(() => {
    if (!editing) setDraft(queryName);
  }, [queryName, editing]);

  useEffect(() => {
    if (editing) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
      window.setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing]);

  const commit = (opts?: { openSave?: boolean }) => {
    const next = draft.trim() || "New Query";
    setEditing(false);
    if (next !== queryName) onRenameQuery(next);
    if (opts?.openSave) onNameBlurSave?.();
  };

  const cancel = () => {
    setDraft(queryName);
    setEditing(false);
  };

  return (
    <div className="d-flex align-items-center justify-content-between w-100 mb-3">
      <div style={{ minWidth: 0 }}>
        {/* Header line: Builder title + Query name */}
        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <div className="fw-semibold" style={{ fontSize: 18 }}>
            Query Studio
          </div>

          <span className="text-muted" style={{ opacity: 0.6 }}>
            •
          </span>

          {/* Query name (editable) */}
          <div className="d-flex align-items-center" style={{ minWidth: 0 }}>
            {!editing ? (
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none"
                onClick={() => setEditing(true)}
                title="Click to rename"
                style={{
                  maxWidth: 520,
                  textAlign: "left",
                  color: "var(--bs-body-color)",
                  fontWeight: 600,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {queryName}
                {queryNameDirty ? (
                  <span className="ms-2 badge bg-warning text-dark" style={{ fontSize: 11 }}>
                    Unsaved
                  </span>
                ) : queryIsSaved ? (
                  <span className="ms-2 badge text-bg-success" style={{ fontSize: 11 }}>
                    Saved
                  </span>
                ) : null}
              </button>
            ) : (
              <input
                ref={inputRef}
                className="form-control form-control-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  if (suppressBlurRef.current) {
                    suppressBlurRef.current = false;
                    return;
                  }
                  commit({ openSave: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    suppressBlurRef.current = true;
                    commit({ openSave: true });
                  }
                  if (e.key === "Escape") {
                    suppressBlurRef.current = true;
                    cancel();
                  }
                }}
                style={{ width: 360 }}
              />
            )}
          </div>
        </div>

        {/* Query Path */}
        {queryPath.length ? (
          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
            {queryPath.map((step, idx) => (
              <React.Fragment key={step.key}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: step.status === "active" ? 600 : 400,
                    color:
                      step.status === "done"
                        ? "var(--bs-success)"
                        : step.status === "active"
                        ? "var(--bs-body-color)"
                        : "var(--bs-secondary)",
                    opacity: step.status === "todo" ? 0.6 : 1,
                  }}
                >
                  {step.label}
                </span>

                {idx < queryPath.length - 1 && (
                  <span className="text-muted" style={{ fontSize: 12, opacity: 0.5 }}>
                    →
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>

      <div className="d-flex align-items-center gap-2 flex-shrink-0">
        {onNewQuery ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onNewQuery}>
            <i className="fa fa-plus me-1" />
            New Query
          </button>
        ) : null}

        {onExpandAll ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onExpandAll}>
            <i className="fa fa-angles-down me-1" />
            Expand all
          </button>
        ) : null}

        {onCollapseAll ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCollapseAll}>
            <i className="fa fa-angles-up me-1" />
            Collapse all
          </button>
        ) : null}

        {onSave ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={onSave} title="Save Query">
            <i className="fa fa-save me-1" />
            Save Query
          </button>
        ) : null}

        {onRestoreAll && hiddenCount > 0 ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onRestoreAll}>
            <i className="fa fa-window-restore me-1" />
            Restore ({hiddenCount})
          </button>
        ) : null}
      </div>
    </div>
  );
};
