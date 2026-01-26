// src/features/cohort-builder/ui/components/ColumnsSection.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ColumnPreviewDrawer } from "./ColumnPreviewDrawer";
import { SectionShell } from "./SectionShell";
import type { SqlColumnRef, SqlColumnKey } from "../../model/sqlJson";
import { colKey as sqlColKey } from "../../model/sqlJson";
import type { DomainColumnRef } from "../../model/domainCatalog";
import "../styles/ncPill.css";

type Props = {
  // ✅ SectionShell plumbing
  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapsible?: boolean;
  onHide?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;

  // data
  rows: DomainColumnRef[];
  searchTerm: string;
  onChangeSearch: (v: string) => void;

  selectedColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  onRemoveSelected: (key: string) => void;

  pageSize: number;
  currentPage: number;
  onChangePage: (p: number) => void;

  loading?: boolean;
  error?: string;
  total?: number;
  domainId: number | null;

  // ✅ sqlJson integration (columns only)
  columnsJson?: SqlColumnRef[] | null;
  onColumnsJsonChange?: (next: SqlColumnRef[]) => void;

  onNext?: () => void;
  onSubmit?: () => void;
};

type PreviewState = { col: DomainColumnRef } | null;

function uniqPreserveOrder(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function arraysEqual(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function shallowRecordEqual(a: Record<string, string>, b: Record<string, string>) {
  if (a === b) return true;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

function reorder(list: string[], from: string, to: string) {
  const fromIdx = list.indexOf(from);
  const toIdx = list.indexOf(to);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return list;

  const next = list.slice();
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

function clampAlias(raw: string) {
  const v = raw.trim().replace(/\s+/g, " ");
  return v.length ? v : "";
}

function colsSig(cols: SqlColumnRef[] | null | undefined) {
  // Order matters (projection order). Normalize null/undefined.
  return (cols ?? [])
    .map((c) =>
      [
        c.columnName ?? "",
        c.modelColumnId ?? "",
        (c as any).workspaceTableId ?? "",
        c.modelTableName ?? "",
        c.fullName ?? "",
        (c as any).tableAlias ?? "",
        (c.alias ?? "").trim(),
      ].join("|")
    )
    .join("~~");
}

/** Build a SqlColumnKey from a DomainColumnRef */
function sqlKeyFromDomainRow(r: DomainColumnRef): SqlColumnKey {
  return {
    modelColumnId: typeof r.modelColumnId === "number" ? r.modelColumnId : null,
    columnName: r.columnName,
    workspaceTableId: typeof r.workspaceTableId === "number" ? r.workspaceTableId : null,
  };
}

/**
 * Return all plausible keys that might represent the same column.
 * This is the core fix: it lets us match:
 * - DomainColumnRef.identityKey
 * - colKey(...) format (wt:..|name:.. or id:..)
 * - legacy `${wtId}:${name}`
 * - name-only fallback
 */
function keysForSqlThing(input: {
  modelColumnId?: number | null;
  workspaceTableId?: number | null;
  columnName: string;
  exprId?: string | null;
}): string[] {
  const keys: string[] = [];
  const { modelColumnId, workspaceTableId, columnName, exprId } = input;

  // canonical via sqlJson.ts
  keys.push(
    sqlColKey({
      modelColumnId: modelColumnId ?? null,
      columnName,
      workspaceTableId: workspaceTableId ?? null,
      exprId: exprId ?? null,
    })
  );

  // common / legacy forms
  if (typeof workspaceTableId === "number") keys.push(`${workspaceTableId}:${columnName}`);
  if (typeof modelColumnId === "number" && modelColumnId !== null) keys.push(`id:${modelColumnId}`);

  // fallback name
  keys.push(`name:${columnName}`);
  keys.push(columnName);

  // unique
  return Array.from(new Set(keys));
}

export const ColumnsSection: React.FC<Props> = ({
  collapsed,
  onToggleCollapsed,
  collapsible = true,
  onHide,
  isFullscreen,
  onToggleFullscreen,

  rows,
  searchTerm,
  onChangeSearch,
  selectedColumnKeys,
  onToggleColumn,
  onRemoveSelected,

  pageSize,
  currentPage,
  onChangePage,

  loading,
  error,
  total,
  domainId,

  columnsJson,
  onColumnsJsonChange,
  onNext,
  onSubmit,
}) => {
  const filteredColumns = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(
      (col) =>
        col.columnName.toLowerCase().includes(term) ||
        (col.columnLabel ?? "").toLowerCase().includes(term) ||
        (col.tableAlias ?? "").toLowerCase().includes(term) ||
        (col.description ?? "").toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  const totalCount = typeof total === "number" ? total : filteredColumns.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const goToPrevPage = () => onChangePage(Math.max(1, currentPage - 1));
  const goToNextPage = () => onChangePage(Math.min(totalPages, currentPage + 1));

  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // ✅ local ordering shadow so drag feels instant
  const [localSelected, setLocalSelected] = useState<string[]>(() =>
    uniqPreserveOrder(selectedColumnKeys)
  );

  // ✅ alias map (local UI state), keyed by a "stable selected key"
  const [aliasByKey, setAliasByKey] = useState<Record<string, string>>({});

  // currently editing key
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftAlias, setDraftAlias] = useState<string>("");
  const draftRef = useRef<HTMLInputElement | null>(null);

  // ✅ Track whether change originated from inside this component (user action)
  const userEditRef = useRef(false);

  /**
   * Maps for finding a DomainColumnRef based on either:
   * - identityKey
   * - colKey(wt/modelColumnId/name)
   * - `${wtId}:${name}` etc
   */
  const rowByAnyKey = useMemo(() => {
    const m = new Map<string, DomainColumnRef>();

    for (const r of rows) {
      // identityKey itself
      m.set(r.identityKey, r);

      // sqlJson colKey() derived key
      const sk = sqlColKey(sqlKeyFromDomainRow(r));
      m.set(sk, r);

      // legacy forms
      if (typeof r.workspaceTableId === "number") m.set(`${r.workspaceTableId}:${r.columnName}`, r);
      if (typeof r.modelColumnId === "number" && r.modelColumnId !== null) m.set(`id:${r.modelColumnId}`, r);

      // name-only
      m.set(`name:${r.columnName}`, r);
      if (!m.has(r.columnName)) m.set(r.columnName, r);
    }

    return m;
  }, [rows]);

  /** Derived column labels keyed by exprId (from columnsJson) */
  const derivedLabelByExprId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of columnsJson ?? []) {
      const exprId = (c as any).exprId ?? null;
      if (!exprId) continue;
      const name = (c.columnName ?? "").trim();
      if (name) m.set(String(exprId), name);
    }
    return m;
  }, [columnsJson]);

  /** A Set of "selected keys" we can test against (includes normalized forms too) */
  const selectedKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const k of selectedColumnKeys) s.add(k);

    // Add normalized/expanded forms for each selected key if we can infer it from columnsJson.
    // This is essential when selectedColumnKeys contains something like "wt:0|name:cw_region"
    // but columnsJson matching used to be "0:cw_region" etc.
    for (const c of columnsJson ?? []) {
      const wtId = (c as any).workspaceTableId ?? null;
      const modelColumnId = c.modelColumnId ?? null;
      const columnName = c.columnName;
      const exprId = (c as any).exprId ?? null;

      for (const kk of keysForSqlThing({ modelColumnId, workspaceTableId: wtId, columnName, exprId })) {
        s.add(kk);
      }
    }
    return s;
  }, [selectedColumnKeys, columnsJson]);

  /**
   * Key for a SqlColumnRef: use canonical colKey() and also accept legacy.
   * We return ONE canonical key to store alias mapping & existingByKey.
   */
  const canonicalKeyForSqlColumn = (c: SqlColumnRef) => {
    // ✅ derived / virtual identity must be stable by exprId
    if ((c as any).exprId) return `expr:${(c as any).exprId}`;
    const wtId = (c as any).workspaceTableId ?? null;
    if (typeof wtId === "number") return `${wtId}:${c.columnName}`;
    const fallback = rowByAnyKey.get(c.columnName);
    return fallback ? fallback.identityKey : c.columnName;
  };

  /** Label for any selected key (works for cw_* even when not in rows) */
  const labelForKey = (key: string) => {
    const hit = rowByAnyKey.get(key);
    if (hit) return hit.columnName;

    // fall back to parse "wt:...|name:xxx" / "name:xxx" / "0:xxx" / plain
    if (key.startsWith("expr:")) {
      const exprId = key.slice(5);
      return derivedLabelByExprId.get(exprId) ?? key;
    }
    if (key.startsWith("wt:")) {
      const ix = key.indexOf("|name:");
      if (ix >= 0) return key.slice(ix + "|name:".length);
    }
    if (key.startsWith("name:")) return key.slice("name:".length);
    if (key.includes(":") && /^[0-9]+:/.test(key)) return key.split(":").slice(1).join(":");
    if (key.startsWith("id:")) return key; // we don't know name
    return key;
  };

  // -----------------------------
  // 1) Keep localSelected in sync (idempotent)
  // -----------------------------
  useEffect(() => {
    const next = uniqPreserveOrder(selectedColumnKeys);
    setLocalSelected((prev) => (arraysEqual(prev, next) ? prev : next));

    // Once props have caught up, we can consider user edit "consumed"
    userEditRef.current = false;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumnKeys.join("|")]);

  // -----------------------------
  // 2) Rehydrate aliases from columnsJson (idempotent)
  //    Keyed by canonicalKeyForSqlColumn but also mapped to any selected key that matches.
  // -----------------------------
  const columnsJsonAliasSig = useMemo(() => {
    return JSON.stringify(
      (columnsJson ?? []).map((c) => ({
        k: canonicalKeyForSqlColumn(c),
        a: (c.alias ?? "").trim(),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnsJson]);

  useEffect(() => {
    if (!columnsJson?.length) return;

    const incoming: Record<string, string> = {};

    for (const c of columnsJson) {
      const a = (c.alias ?? "").trim();
      if (!a) continue;

      const wtId = (c as any).workspaceTableId ?? null;
      const modelColumnId = c.modelColumnId ?? null;
      const columnName = c.columnName;
      const exprId = (c as any).exprId ?? null;

      const possible = keysForSqlThing({
        modelColumnId,
        workspaceTableId: typeof wtId === "number" ? wtId : null,
        columnName,
        exprId,
      });

      // prefer canonical, but also populate other possible keys so UI can find it
      for (const k of possible) incoming[k] = a;
    }

    setAliasByKey((prev) => {
      const merged = { ...prev, ...incoming };
      return shallowRecordEqual(prev, merged) ? prev : merged;
    });
  }, [columnsJsonAliasSig, columnsJson]);

  const toggle = (key: string) => {
    userEditRef.current = true;

    const isSelected = selectedKeySet.has(key);
    onToggleColumn(key);

    // keep localSelected in sync immediately
    setLocalSelected((prev) => {
      if (isSelected) return prev.filter((x) => x !== key);
      return prev.includes(key) ? prev : [...prev, key];
    });

    setPressedKey(key);
    window.setTimeout(() => {
      setPressedKey((cur) => (cur === key ? null : cur));
    }, 140);
  };

  const removePill = (key: string) => {
    userEditRef.current = true;

    if (editingKey === key) {
      setEditingKey(null);
      setDraftAlias("");
    }

    onRemoveSelected(key);

    setLocalSelected((prev) => prev.filter((x) => x !== key));

    setAliasByKey((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearAllSelected = () => {
    userEditRef.current = true;

    setEditingKey(null);
    setDraftAlias("");
    setPreview(null);

    for (const key of [...localSelected]) {
      onRemoveSelected(key);
    }

    setLocalSelected([]);
    setAliasByKey({});
  };

  // ✅ Preview drawer state (row payload only)
  const [preview, setPreview] = useState<PreviewState>(null);
  const closePreview = () => setPreview(null);

  /** ---------------------------------------------------------
   * ✅ Selected pills drag & drop
   * ---------------------------------------------------------- */
  const dragNameRef = useRef<string | null>(null);

  const onPillDragStart = (name: string) => {
    userEditRef.current = true;
    dragNameRef.current = name;
  };

  const onPillDropOn = (targetName: string) => {
    userEditRef.current = true;

    const from = dragNameRef.current;
    dragNameRef.current = null;
    if (!from || from === targetName) return;

    setLocalSelected((prev) => reorder(prev, from, targetName));
  };

  /** ---------------------------------------------------------
   * ✅ Emit SqlColumnRef[] (rehydrate-safe)
   *   - preserves existing SqlColumnRef objects whenever possible,
   *     which is critical for workspaceTableId=0 crosswalk cols.
   * ---------------------------------------------------------- */
  const lastEmittedSigRef = useRef<string>("");

  const baseColsSig = useMemo(() => colsSig(columnsJson ?? []), [columnsJson]);

  useEffect(() => {
    lastEmittedSigRef.current = "";
  }, [baseColsSig]);

  useEffect(() => {
    if (!onColumnsJsonChange) return;

    const propSelected = uniqPreserveOrder(selectedColumnKeys);
    const rehydrateComplete = arraysEqual(localSelected, propSelected);

    if (!userEditRef.current && !rehydrateComplete) return;

    // Index existing column refs by *all plausible keys*
    const existingByKey = new Map<string, SqlColumnRef>();
    for (const c of columnsJson ?? []) {
      const wtId = (c as any).workspaceTableId ?? null;
      const modelColumnId = c.modelColumnId ?? null;
      const columnName = c.columnName;
      const exprId = (c as any).exprId ?? null;

      for (const k of keysForSqlThing({
        modelColumnId,
        workspaceTableId: typeof wtId === "number" ? wtId : null,
        columnName,
        exprId,
      })) {
        existingByKey.set(k, c);
      }
    }

    const nextCols: SqlColumnRef[] = localSelected.map((key) => {
      const prev = existingByKey.get(key) ?? null;
      const row = rowByAnyKey.get(key) ?? null;

      const columnName = row?.columnName ?? prev?.columnName ?? labelForKey(key);

      // use alias from any matching key if present
      const alias = (aliasByKey[key] ?? "").trim();
      const aliasOrNull = alias ? alias : null;

      // preserve prior identity whenever possible
      const prevWt = prev ? (prev as any).workspaceTableId : null;
      const prevExpr = prev ? (prev as any).exprId : null;

      const rowWt = row?.workspaceTableId ?? null;
      const rowModelColId = row?.modelColumnId ?? null;
      const rowExprId = row?.identityKey?.startsWith("expr:") ? row.identityKey.slice(5) : null;

      const workspaceTableId =
        (typeof prevWt === "number" ? prevWt : null) ??
        (typeof rowWt === "number" ? rowWt : null) ??
        null;

      const modelColumnId =
        (typeof (prev?.modelColumnId ?? null) === "number" ? (prev?.modelColumnId ?? null) : null) ??
        (typeof rowModelColId === "number" ? rowModelColId : null) ??
        null;

      return {
        modelColumnId,
        workspaceTableId,
        columnName,
        modelTableName: prev?.modelTableName ?? row?.modelTableName ?? null,
        fullName: prev?.fullName ?? row?.fullName ?? null,
        tableAlias: (prev as any)?.tableAlias ?? row?.tableAlias ?? null,
        alias: aliasOrNull,
        // ✅ keep expr identity stable (for cw/cohort/dataprep derived cols)
        exprId: (prev as any)?.exprId ?? rowExprId ?? null,
      } as SqlColumnRef;
    });

    const nextSig = colsSig(nextCols);
    if (nextSig === baseColsSig) return;
    if (nextSig === lastEmittedSigRef.current) return;

    lastEmittedSigRef.current = nextSig;
    onColumnsJsonChange(nextCols);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    localSelected.join("|"),
    JSON.stringify(aliasByKey),
    rows,
    baseColsSig,
    onColumnsJsonChange,
    columnsJson,
    selectedColumnKeys.join("|"),
    rowByAnyKey,
    selectedKeySet,
  ]);

  /** -----------------------------
   * Double-click-to-edit alias
   * ----------------------------- */
  const startEdit = (key: string) => {
    setEditingKey(key);
    setDraftAlias(aliasByKey[key] ?? "");

    requestAnimationFrame(() => {
      draftRef.current?.focus();
      draftRef.current?.select();
    });
  };

  const commitEdit = (key: string) => {
    userEditRef.current = true;

    const v = clampAlias(draftAlias);

    setAliasByKey((prev) => {
      const next = { ...prev };
      if (!v) delete next[key];
      else next[key] = v;
      return shallowRecordEqual(prev, next) ? prev : next;
    });

    setEditingKey(null);
    setDraftAlias("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftAlias("");
  };

  return (
    <SectionShell
      id="columns"
      title="Columns"
      subtitle="Search and select columns for your query."
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      collapsible={collapsible}
      iconClass="fa-table-columns"
      count={selectedColumnKeys.length}
      onHide={onHide}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
    >
      <>
        <div className="mb-3">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder={
              domainId == null
                ? "Select a domain to browse columns…"
                : "Search columns by name or description…"
            }
            value={searchTerm}
            onChange={(e) => onChangeSearch(e.target.value)}
            disabled={domainId == null}
          />
        </div>

        {error ? <div className="alert alert-danger py-2">{error}</div> : null}
        {loading ? <div className="text-muted small mb-2">Loading…</div> : null}

        {localSelected.length > 0 && (
          <>
            <div className="d-flex align-items-center justify-content-between mb-1">
              <div className="text-muted small">
                Selected columns (drag pills to set output order, double click to add an alias)
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={clearAllSelected}
                title="Clear all selected columns"
              >
                <i className="fa fa-eraser me-1" />
                Clear all
              </button>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {localSelected.map((key, idx) => {
                const alias = (aliasByKey[key] ?? "").trim();
                const isEditing = editingKey === key;
                const hasAlias = Boolean(alias);
                const label = labelForKey(key);

                return (
                  <span
                    key={key}
                    className={`nc-pill ${idx === 0 ? "is-primary" : ""} ${
                      hasAlias ? "has-alias" : ""
                    } ${isEditing ? "is-editing" : ""}`}
                    draggable={!isEditing}
                    onDragStart={() => !isEditing && onPillDragStart(key)}
                    onDragOver={(e) => !isEditing && e.preventDefault()}
                    onDrop={() => !isEditing && onPillDropOn(key)}
                    title={
                      hasAlias
                        ? `Alias: ${alias}\nOriginal: ${label}`
                        : `Column: ${label}\nDouble-click to alias`
                    }
                  >
                    <span className="nc-pill-grip" aria-hidden="true" title="Drag">
                      <i className="fa fa-grip-vertical" />
                    </span>

                    <span className="nc-pill-index" title={`Column order: ${idx + 1}`}>
                      {idx + 1}
                    </span>

                    <span
                      className="nc-pill-text"
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startEdit(key);
                      }}
                      title="Double-click to edit alias"
                    >
                      {!isEditing ? (
                        <>
                          <div className="nc-pill-labelline">
                            <span className="nc-pill-label">{hasAlias ? alias : label}</span>
                          </div>

                          {hasAlias ? (
                            <div className="nc-pill-orig" title={`Original: ${label}`}>
                              {label}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <input
                          ref={draftRef}
                          className="nc-pill-input"
                          value={draftAlias}
                          placeholder="Enter alias…"
                          onChange={(e) => setDraftAlias(e.target.value)}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              commitEdit(key);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              cancelEdit();
                            }
                          }}
                          onBlur={() => commitEdit(key)}
                          aria-label={`Alias for ${label}`}
                        />
                      )}
                    </span>

                    <button
                      type="button"
                      className="nc-pill-remove"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removePill(key);
                      }}
                      aria-label={`Remove ${label}`}
                      title="Remove"
                    >
                      <i className="fa fa-xmark" />
                    </button>
                  </span>
                );
              })}
            </div>
          </>
        )}

        <div className="table-responsive border rounded">
          <table className="table table-sm table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: "40px" }} />
                <th style={{ width: "35%" }}>Column</th>
                <th>Description</th>
              </tr>
            </thead>

            <tbody>
              {filteredColumns.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted text-center py-3">
                    {domainId == null ? "Select a domain to browse columns." : "No columns match your search."}
                  </td>
                </tr>
              ) : (
                filteredColumns.map((col) => {
                  // ✅ selection check against normalized set
                  const checked =
                    selectedKeySet.has(col.identityKey) ||
                    selectedKeySet.has(sqlColKey(sqlKeyFromDomainRow(col))) ||
                    selectedKeySet.has(`${col.workspaceTableId}:${col.columnName}`) ||
                    (col.modelColumnId != null ? selectedKeySet.has(`id:${col.modelColumnId}`) : false) ||
                    selectedKeySet.has(`name:${col.columnName}`) ||
                    selectedKeySet.has(col.columnName);

                  const pressed = pressedKey === col.identityKey;
                  const label = col.columnName;
                  const tableLabel = col.tableAlias ?? col.modelTableName;

                  return (
                    <tr
                      key={col.identityKey}
                      className={`nc-col-row ${checked ? "is-selected" : ""} ${pressed ? "is-pressed" : ""}`}
                      onClick={() => toggle(col.identityKey)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={checked}
                      title="Click row to toggle"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(col.identityKey);
                        }
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <label className="nc-col-checkbox-wrap" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="nc-col-checkbox-input"
                            checked={checked}
                            onChange={() => toggle(col.identityKey)}
                            aria-label={`Toggle ${label}`}
                          />
                          <span className={`nc-col-checkbox-ui ${checked ? "is-checked" : ""}`} />
                        </label>
                      </td>

                      <td>
                        <div className="fw-semibold">{label}</div>
                        {tableLabel ? <small className="text-muted">{tableLabel}</small> : null}

                        <div className="mt-1">
                          <a
                            href="#"
                            className="nc-preview-link small"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreview({ col });
                            }}
                          >
                            Preview data
                          </a>
                        </div>
                      </td>

                      <td>
                        <div className="nc-col-description">
                          {col.description ?? <span className="text-muted">No description</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <small className="text-muted">
            Showing {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} –{" "}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} columns
          </small>

          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        </div>

        {preview ? (
          <ColumnPreviewDrawer
            open={!!preview}
            onClose={closePreview}
            col={preview.col}
            isSelected={
              selectedKeySet.has(preview.col?.identityKey) ||
              selectedKeySet.has(sqlColKey(sqlKeyFromDomainRow(preview.col))) ||
              selectedKeySet.has(`${preview.col.workspaceTableId}:${preview.col.columnName}`)
            }
            onSelectAndClose={() => {
              const key = preview.col?.identityKey;
              if (key && !selectedKeySet.has(key)) {
                toggle(key);
              }
              closePreview();
            }}
          />
        ) : null}

        {onNext || onSubmit ? (
          <div className="d-flex flex-column align-items-start mt-3 pt-3 border-top">
            <div className="d-flex align-items-center gap-2">
              {onNext ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={onNext}>
                  Next
                </button>
              ) : null}
            {onSubmit ? (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onSubmit}>
                Save
              </button>
            ) : null}
            </div>
            <div className="text-muted small mt-1">Optionally add data prep steps next.</div>
          </div>
        ) : null}
      </>
    </SectionShell>
  );
};

export default ColumnsSection;
