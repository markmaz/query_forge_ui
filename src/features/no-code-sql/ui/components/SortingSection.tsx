import React, { useEffect, useMemo, useRef, useState } from "react";
import { SectionShell } from "./SectionShell";
import { EmptySectionState } from "../../../../shared/ui/EmptySectionState";
import type { SqlSort, SqlColumnKey } from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";
import { SqlColumnPicker } from "./ColumnSelector";

type SortDir = "asc" | "desc";

type Props = {
  selectedColumns: SqlColumnKey[];
  allColumns?: SqlColumnKey[];

  value?: SqlSort[];
  onChange?: (next: SqlSort[]) => void;

  onFocusColumn?: (columnName: string) => void;

  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  collapsible?: boolean;
  onHide?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

const isValidSort = (s: any): s is SqlSort =>
  !!s && typeof s === "object" && !!s.col && typeof s.dir === "string";

export const SortingSection: React.FC<Props> = ({
  selectedColumns,
  allColumns,
  value,
  onChange,
  onFocusColumn,
  collapsed,
  onToggleCollapsed,
  collapsible = true,
  onHide,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const columnOptions = allColumns && allColumns.length ? allColumns : selectedColumns;
  const selectedKeys = useMemo(() => columnOptions ?? [], [columnOptions]);

  const [internal, setInternal] = useState<SqlSort[]>(() => (value ?? []).filter(isValidSort));
  const sort = (value ?? internal).filter(isValidSort);

  useEffect(() => {
    if (value) setInternal(value.filter(isValidSort));
  }, [value]);

  const commit = (next: SqlSort[]) => {
    const cleaned = (next ?? []).filter(isValidSort);
    if (!value) setInternal(cleaned);
    onChange?.(cleaned);
  };

  // ✅ prune and upgrade sorts when selected columns change (match by sameCol, not colKey)
  useEffect(() => {
    const next = sort
      .map((s) => {
        const match =
          selectedKeys.find((c) => sameCol(c, s.col)) ??
          selectedKeys.find((c) => c.modelColumnId != null && c.modelColumnId === s.col.modelColumnId) ??
          selectedKeys.find((c) => c.columnName === s.col.columnName);
        return match ? { ...s, col: match } : s;
      })
      .filter((s) => selectedKeys.some((c) => sameCol(c, s.col)));

    const changed = next.length !== sort.length || next.some((s, i) => colKey(s.col) !== colKey(sort[i]?.col));
    if (changed) commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKeys.map(colKey).join("|")]);

  const addable = useMemo(() => {
    // A column is "already sorted" if any existing sort matches it by sameCol()
    return selectedKeys.filter((c) => !sort.some((s) => sameCol(s.col, c)));
  }, [selectedKeys, sort]);

  const addFirst = () => {
    const first = addable[0];
    if (!first) return;
    commit([...sort, { col: first, dir: "asc" }]);
  };

  const addByKey = (k: string) => {
    const c = selectedKeys.find((x) => colKey(x) === k);
    if (!c) return;
    commit([...sort, { col: c, dir: "asc" }]);
  };

  const remove = (k: string) => {
    // remove by identity key for UI consistency
    commit(sort.filter((s) => colKey(s.col) !== k));
  };

  const toggleDir = (k: string) => {
    commit(
      sort.map((s) =>
        colKey(s.col) === k ? { ...s, dir: (s.dir === "asc" ? "desc" : "asc") as SortDir } : s
      )
    );
  };

  // Drag & drop
  const dragKeyRef = useRef<string | null>(null);
  const onDragStart = (k: string) => (dragKeyRef.current = k);

  const onDropOn = (targetKey: string) => {
    const fromKey = dragKeyRef.current;
    dragKeyRef.current = null;
    if (!fromKey || fromKey === targetKey) return;
    commit(reorder(sort, fromKey, targetKey));
  };

  const body = (
    <div>
      {selectedKeys.length === 0 ? (
        <EmptySectionState
          iconClass="fa-sort"
          title="No columns selected yet"
          subtitle="Select at least one column to enable sorting."
        />
      ) : (
        <>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="text-muted small">Sort order is top → bottom. Drag rows to reorder.</div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => commit([])}
                disabled={sort.length === 0}
                title="Clear sorting"
              >
                <i className="fa fa-eraser me-1" aria-hidden="true" />
                Clear
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addFirst}
                disabled={addable.length === 0}
                title={addable.length === 0 ? "All selected columns are already sorted" : "Add a sort column"}
              >
                <i className="fa fa-plus me-1" aria-hidden="true" />
                Add
              </button>
            </div>
          </div>

          {addable.length > 0 ? (
            <div className="d-flex align-items-center gap-2 mb-3">
              <div className="text-muted small" style={{ width: 92 }}>
                Add column
              </div>
              <div style={{ maxWidth: 420, width: "100%" }}>
                <SqlColumnPicker
                  columns={selectedKeys}
                  selectedColumns={selectedColumns}
                  showSelectedBadge
                  value={null}
                  onChange={(next) => {
                    if (!next) return;
                    if (sort.some((s) => sameCol(s.col, next))) return;
                    addByKey(colKey(next));
                  }}
                  placeholder="Choose…"
                />
              </div>
            </div>
          ) : null}

          {sort.length === 0 ? (
            <EmptySectionState
              iconClass="fa-sort"
              title="No sorting applied"
              subtitle="Add one or more columns to sort your preview/export results."
            />
          ) : (
            <div className="list-group">
              {sort.map((s, idx) => {
                const k = colKey(s.col);
                const isFirst = idx === 0;

                return (
                  <div
                    key={k}
                    className="list-group-item d-flex align-items-center justify-content-between"
                    style={{
                      borderRadius: 10,
                      marginBottom: 8,
                      background: "linear-gradient(135deg, rgba(0,0,0,0.02), rgba(0,0,0,0.01))",
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                    draggable
                    onDragStart={() => onDragStart(k)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropOn(k)}
                    title="Drag to reorder"
                  >
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <span
                        className="text-muted"
                        aria-hidden="true"
                        style={{ cursor: "grab", width: 18, textAlign: "center", opacity: 0.7 }}
                        title="Drag"
                      >
                        <i className="fa fa-grip-vertical" />
                      </span>

                      <span
                        className="badge bg-light text-dark"
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 999,
                          width: 28,
                          height: 22,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                        }}
                        title={isFirst ? "Primary sort" : "Sort priority"}
                      >
                        {idx + 1}
                      </span>

                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none text-dark text-truncate"
                        style={{ maxWidth: 520, fontWeight: 600 }}
                        onClick={() => onFocusColumn?.(s.col.columnName)}
                        title={labelFor(s.col)}
                      >
                        {labelFor(s.col)}
                      </button>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => toggleDir(k)}
                        title={
                          s.dir === "asc"
                            ? "Ascending (click to switch to descending)"
                            : "Descending (click to switch to ascending)"
                        }
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          background: "rgba(255,255,255,0.8)",
                          borderRadius: 10,
                          padding: "4px 10px",
                        }}
                      >
                        <span className="me-1 text-muted" style={{ fontSize: 12 }}>
                          {s.dir.toUpperCase()}
                        </span>
                        <i className={"fa " + (s.dir === "asc" ? "fa-arrow-up" : "fa-arrow-down")} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => remove(k)}
                        title="Remove from sort"
                        style={{ border: "none", background: "transparent", opacity: 0.65, padding: "4px 8px" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
                      >
                        <i className="fa fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

  const useShell = typeof collapsed === "boolean" && typeof onToggleCollapsed === "function";
  if (!useShell) return body;

  const right = (
    <div className="d-flex align-items-center gap-2">
      {onToggleFullscreen ? (
        <button
          type="button"
          className="btn btn-sm"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          style={{ border: "none", background: "transparent", padding: "2px 6px", lineHeight: 1, opacity: 0.65 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
        >
          <i className={`fa ${isFullscreen ? "fa-compress" : "fa-expand"}`} />
        </button>
      ) : null}

      {onHide ? (
        <button
          type="button"
          className="btn btn-sm"
          onClick={onHide}
          aria-label="Hide Sorting"
          title="Hide section"
          style={{ border: "none", background: "transparent", padding: "2px 6px", lineHeight: 1, opacity: 0.65 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
        >
          <i className="fa fa-xmark" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return (
    <SectionShell
      id="sorting"
      title="Sorting"
      subtitle="Choose sort order for preview/export."
      collapsed={collapsed!}
      onToggleCollapsed={onToggleCollapsed!}
      collapsible={collapsible}
      iconClass="fa-sort"
      count={sort.length ? sort.length : undefined}
      right={right}
    >
      {body}
    </SectionShell>
  );
};

// ---------- helpers ----------
function reorder(items: SqlSort[], fromKey: string, toKey: string): SqlSort[] {
  const fromIdx = items.findIndex((x) => colKey(x.col) === fromKey);
  const toIdx = items.findIndex((x) => colKey(x.col) === toKey);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export default SortingSection;
