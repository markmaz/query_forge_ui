// TopBar.tsx
import React, { useEffect, useRef, useState } from "react";

export const TopBar: React.FC<{
  title?: string;
  name: string;
  nameDirty?: boolean;
  onRename: (next: string) => void;
  onSave?: () => void;
  canSave: boolean;
}> = ({
  title = "Cohort Builder",
  name,
  nameDirty = false,
  onRename,
  onSave,
  canSave,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
      window.setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || "New Cohort";
    setEditing(false);
    if (next !== name) onRename(next);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  return (
    <div className="d-flex align-items-center justify-content-between w-100 mb-3">
      <div style={{ minWidth: 0 }}>
        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <div className="fw-semibold" style={{ fontSize: 18 }}>
            {title}
          </div>

          <span className="text-muted" style={{ opacity: 0.6 }}>
            •
          </span>

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
                  color: "var(--bs-dark)",
                  fontWeight: 600,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {name}
                {nameDirty ? (
                  <span className="ms-2 badge bg-warning text-dark" style={{ fontSize: 11 }}>
                    Unsaved
                  </span>
                ) : null}
              </button>
            ) : (
              <input
                ref={inputRef}
                className="form-control form-control-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancel();
                }}
                style={{ width: 320 }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 ms-auto">
        <button
          className="btn btn-outline-secondary"
          disabled={!canSave}
          title={!canSave ? 'Enter a prompt to enable saving' : 'Save cohort'}
          onClick={onSave}
        >
          <i className="fa fa-save me-2" />
          Save
        </button>
      </div>
    </div>
  );
};
