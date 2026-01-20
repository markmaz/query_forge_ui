// src/shared/ui/ColumnPicker.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { DomainColumnRef, FieldRef } from  "../../model/domainCatalog"
import type { SqlColumnKey } from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";

type Props = {
  columns: DomainColumnRef[];              // full domain list (can be paged; works either way)
  selectedColumnKeys?: string[];           // used to pin “Selected” group
  value: FieldRef | null;
  onChange: (next: FieldRef | null) => void;

  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;

  // optional: show table prefix in label
  showTable?: boolean;
};

function labelForColumn(c: DomainColumnRef, showTable?: boolean) {
  if (showTable && c.tableAlias) return `${c.tableAlias}.${c.columnName}`;
  return showTable ? `${c.modelTableName}.${c.columnName}` : c.columnName;
}

export const ColumnPicker: React.FC<Props> = ({
  columns,
  selectedColumnKeys = [],
  value,
  onChange,
  placeholder = "Search columns…",
  disabled,
  allowClear = true,
  showTable = false,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedSet = useMemo(() => new Set<string>(selectedColumnKeys), [selectedColumnKeys]);

  const byKey = useMemo(() => {
    const m = new Map<string, DomainColumnRef>();
    columns.forEach((c) => m.set(c.identityKey, c));
    return m;
  }, [columns]);

  const currentLabel = useMemo(() => {
    if (!value) return "";
    if (value.kind === "computed") return `ƒ ${value.id}`; // you can improve this later with computed alias map

    if (value.kind === "column") {
      const key = `${value.workspaceTableId}:${value.columnName}`;
      const hit = byKey.get(key);
      return hit ? labelForColumn(hit, showTable) : `Column ${value.columnName}`;
    }

    // Fallback for other kinds (keeps TypeScript happy)
    return `Column ${(value as any).id ?? ""}`;
  }, [value, byKey, showTable]);

  const term = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!term) return columns;

    return columns.filter((c) => {
      const a = c.columnName.toLowerCase();
      const b = c.modelTableName.toLowerCase();
      const d = (c.description ?? "").toLowerCase();
      return a.includes(term) || b.includes(term) || d.includes(term);
    });
  }, [columns, term]);

  const pinnedSelected = useMemo(() => {
    const xs = filtered.filter((c) => selectedSet.has(c.identityKey));
    xs.sort((a, b) => labelForColumn(a, showTable).localeCompare(labelForColumn(b, showTable)));
    return xs;
  }, [filtered, selectedSet, showTable]);

  const rest = useMemo(() => {
    const xs = filtered.filter((c) => !selectedSet.has(c.identityKey));
    xs.sort((a, b) => labelForColumn(a, showTable).localeCompare(labelForColumn(b, showTable)));
    return xs;
  }, [filtered, selectedSet, showTable]);

  const pick = (c: DomainColumnRef) => {
    onChange({
      kind: "column",
      workspaceTableId: c.workspaceTableId,
      columnName: c.columnName,
      modelColumnId: c.modelColumnId ?? null,
    });
    setOpen(false);
    setQ("");
  };

  const close = () => {
    setOpen(false);
    setQ("");
  };

  const computePos = () => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    computePos();

    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onScrollOrResize = () => computePos();
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <div className="position-relative" ref={boxRef}>
      <button
        type="button"
        className="form-control form-control-sm d-flex align-items-center justify-content-between"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: disabled ? "not-allowed" : "pointer", maxWidth: 360 }}
      >
        <span className="text-truncate" style={{ maxWidth: "92%" }}>
          {value ? currentLabel : <span className="text-muted">{placeholder}</span>}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>

      {open && !disabled && pos ? ReactDOM.createPortal(
            <div
              ref={menuRef}
              className="border rounded shadow-sm bg-white position-absolute mt-1"
          style={{
            zIndex: 2000,
            width: pos.width,
            maxHeight: 320,
            overflow: "auto",
            top: pos.top,
            left: pos.left,
          }}
        >
          <div className="p-2 border-bottom">
            <input
              className="form-control form-control-sm"
              placeholder={placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <div className="d-flex align-items-center justify-content-between mt-2">
              <small className="text-muted">
                {filtered.length} column{filtered.length === 1 ? "" : "s"}
              </small>
              {allowClear ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onChange(null)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {pinnedSelected.length > 0 ? (
            <div className="p-2">
              <div className="text-muted small fw-semibold mb-1">Selected</div>
              <div className="list-group list-group-flush">
                {pinnedSelected.map((c) => (
                  <button
                    type="button"
                    key={c.identityKey}
                    className="list-group-item list-group-item-action py-2"
                    onClick={() => pick(c)}
                    title={c.description ?? ""}
                  >
                    <div className="d-flex justify-content-between">
                      <div className="text-truncate" style={{ color: "rgb(26, 86, 82)" }}>
                        {labelForColumn(c, showTable)}
                      </div>
                      <span
                        className="badge"
                        style={{
                          color: "rgb(26, 86, 82)",
                          background: "rgba(26, 86, 82, 0.12)",
                          border: "1px solid rgba(26, 86, 82, 0.25)",
                        }}
                      >
                        Selected
                      </span>
                    </div>
                    {c.description ? (
                      <div className="small text-muted text-truncate">{c.description}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="p-2 pt-0">
            <div className="text-muted small fw-semibold mb-1">All columns</div>
            <div className="list-group list-group-flush">
              {rest.length === 0 ? (
                <div className="text-muted small px-2 py-2">No matches.</div>
              ) : (
                rest.map((c) => (
                  <button
                    type="button"
                    key={c.identityKey}
                    className="list-group-item list-group-item-action py-2"
                    onClick={() => pick(c)}
                    title={c.description ?? ""}
                  >
                    <div className="d-flex justify-content-between">
                      <div
                        className="text-truncate"
                        style={selectedSet.has(c.identityKey) ? { color: "rgb(26, 86, 82)" } : undefined}
                      >
                        {labelForColumn(c, showTable)}
                      </div>
                      {selectedSet.has(c.identityKey) ? (
                        <span
                          className="badge"
                          style={{
                            color: "rgb(26, 86, 82)",
                            background: "rgba(26, 86, 82, 0.12)",
                            border: "1px solid rgba(26, 86, 82, 0.25)",
                          }}
                        >
                          Selected
                        </span>
                      ) : null}
                    </div>
                    {c.description ? (
                      <div className="small text-muted text-truncate">{c.description}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="p-2 border-top d-flex justify-content-end">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={close}>
              Close
            </button>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
};

type SqlColumnPickerProps = {
  columns: SqlColumnKey[];
  selectedColumns?: SqlColumnKey[];
  value: SqlColumnKey | null;
  onChange: (next: SqlColumnKey | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showSelectedBadge?: boolean;
  labelByKey?: Map<string, string>;
};

export const SqlColumnPicker: React.FC<SqlColumnPickerProps> = ({
  columns,
  selectedColumns = [],
  value,
  onChange,
  placeholder = "Search columns…",
  disabled,
  allowClear = true,
  showSelectedBadge,
  labelByKey,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedSet = useMemo(() => new Set<string>(selectedColumns.map(colKey)), [selectedColumns]);

  const labelForCol = (c: SqlColumnKey) => {
    const key = colKey(c);
    return labelByKey?.get(key) ?? labelFor(c);
  };

  const currentLabel = useMemo(() => {
    if (!value) return "";
    return labelForCol(value);
  }, [value, labelByKey]);

  const term = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!term) return columns;
    return columns.filter((c) => {
      const label = labelForCol(c).toLowerCase();
      const name = (c.columnName ?? "").toLowerCase();
      return label.includes(term) || name.includes(term);
    });
  }, [columns, term, labelByKey]);

  const selectedItems = useMemo(() => {
    const xs = filtered.filter((c) => selectedSet.has(colKey(c)));
    xs.sort((a, b) => labelForCol(a).localeCompare(labelForCol(b)));
    return xs;
  }, [filtered, selectedSet, labelByKey]);

  const restItems = useMemo(() => {
    const xs = filtered.filter((c) => !selectedSet.has(colKey(c)));
    xs.sort((a, b) => labelForCol(a).localeCompare(labelForCol(b)));
    return xs;
  }, [filtered, selectedSet, labelByKey]);

  const pick = (c: SqlColumnKey) => {
    onChange(c);
    setOpen(false);
    setQ("");
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
    setQ("");
  };

  const computePos = () => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    computePos();

    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onScrollOrResize = () => computePos();
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <div className="position-relative" ref={boxRef}>
      <button
        type="button"
        className="form-control form-control-sm d-flex align-items-center justify-content-between"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: disabled ? "not-allowed" : "pointer", maxWidth: 360 }}
      >
        <span className="text-truncate" style={{ maxWidth: "92%" }}>
          {value ? currentLabel : <span className="text-muted">{placeholder}</span>}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>

      {open && !disabled && pos ? ReactDOM.createPortal(
            <div
              ref={menuRef}
              className="border rounded shadow-sm bg-white position-absolute mt-1"
          style={{
            zIndex: 2000,
            width: pos.width,
            maxHeight: 320,
            overflow: "auto",
            top: pos.top,
            left: pos.left,
          }}
        >
          <div className="p-2 border-bottom">
            <input
              className="form-control form-control-sm"
              placeholder={placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>

          {selectedItems.length > 0 ? (
            <>
              <div className="px-3 pt-2 pb-1 text-uppercase text-muted small">Selected</div>
              {selectedItems.map((c) => {
                const k = colKey(c);
                const isActive = value ? sameCol(value, c) : false;
                return (
                  <div
                    key={k}
                    className={`px-3 py-2 d-flex align-items-center justify-content-between ${
                      isActive ? "bg-light" : ""
                    }`}
                    role="button"
                    onClick={() => pick(c)}
                  >
                    <div
                      className="text-truncate"
                      style={{ maxWidth: "85%", ...(selectedSet.has(k) ? { color: "rgb(26, 86, 82)" } : {}) }}
                    >
                      {labelForCol(c)}
                    </div>
                    {showSelectedBadge ? (
                      <span
                        className="badge"
                        style={{
                          color: "rgb(26, 86, 82)",
                          background: "rgba(26, 86, 82, 0.12)",
                          border: "1px solid rgba(26, 86, 82, 0.25)",
                        }}
                      >
                        Selected
                      </span>
                    ) : null}
                  </div>
                );
              })}
              <div className="border-top" />
            </>
          ) : null}

          {restItems.map((c) => {
            const k = colKey(c);
            const isActive = value ? sameCol(value, c) : false;
            return (
                  <div
                    key={k}
                    className={`px-3 py-2 d-flex align-items-center justify-content-between ${
                      isActive ? "bg-light" : ""
                    }`}
                    role="button"
                    onClick={() => pick(c)}
                  >
                    <div
                      className="text-truncate"
                      style={{ maxWidth: "85%", ...(selectedSet.has(k) ? { color: "rgb(26, 86, 82)" } : {}) }}
                    >
                      {labelForCol(c)}
                    </div>
                    {showSelectedBadge && selectedSet.has(k) ? (
                      <span
                        className="badge"
                        style={{
                          color: "rgb(26, 86, 82)",
                          background: "rgba(26, 86, 82, 0.12)",
                          border: "1px solid rgba(26, 86, 82, 0.25)",
                        }}
                      >
                        Selected
                      </span>
                    ) : null}
                  </div>
            );
          })}

          {allowClear && value ? (
            <div className="border-top px-3 py-2">
              <button type="button" className="btn btn-sm btn-link p-0 text-decoration-none" onClick={clear}>
                Clear selection
              </button>
            </div>
          ) : null}
        </div>,
        document.body
      ) : null}
    </div>
  );
};
