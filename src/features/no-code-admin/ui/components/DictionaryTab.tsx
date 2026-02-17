import React, { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  ModelColumnRow,
  createModelColumn,
  fetchModelColumns,
  fetchModelTables,
  patchModelColumn,
  searchModelColumns,
  uploadModel,
} from "../../../../shared/services/noCodeAdminApi";

import { EmptySectionState } from "../../../../shared/ui/EmptySectionState";
import "../style/dictionaryTab.css";

const DATA_TYPE_OPTIONS = [
  "string",
  "int",
  "bigint",
  "double",
  "decimal",
  "boolean",
  "date",
  "timestamp",
] as const;

const GLOBAL_SEARCH_LIMIT = 200;
const GLOBAL_SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string, query: string) {
  if (!query) return text;

  const safe = escapeRegExp(query);
  const regex = new RegExp(`(${safe})`, "ig");
  const parts = text.split(regex);

  return parts.map((part, idx) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className="dict-hit-mark">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
    )
  );
}

function buildDescriptionSnippet(description: string | null | undefined, query: string, maxLen = 110) {
  const source = (description ?? "").trim();
  if (!source) return null;
  if (!query) return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;

  const lower = source.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);

  if (idx < 0) return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;

  const contextBefore = 24;
  const contextAfter = maxLen - query.length - contextBefore;
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(source.length, idx + query.length + Math.max(24, contextAfter));
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

function toColumnLookupKey(tableName: string, columnName: string) {
  return `${tableName}::${columnName}`.toLowerCase();
}

/** ---------- Uncontrolled textarea editor (Description) ---------- */
function InlineTextArea(props: {
  value: string;
  placeholder?: string;
  onSave: (next: string) => void;
  disabled?: boolean;
  resetKey: string;
  onDone?: () => void;
}) {
  const [dirty, setDirty] = useState(false);

  return (
    <div className="d-flex gap-2 align-items-start">
      <textarea
        key={props.resetKey}
        className="form-control form-control-sm dict-textarea"
        defaultValue={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          const next = e.target.value ?? "";
          if (dirty && next !== props.value) props.onSave(next);
          setDirty(false);
          props.onDone?.();
        }}
      />
      {dirty ? <span className="text-muted small mt-1">●</span> : null}
    </div>
  );
}

/** ---------- Uncontrolled data type dropdown editor ---------- */
function DataTypeSelect(props: {
  value: string | null;
  options: readonly string[];
  disabled?: boolean;
  onSave: (next: string | null) => void;
  resetKey: string;
  onDone?: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const initial = props.value ?? "";

  return (
    <div className="d-flex gap-2 align-items-center">
      <select
        key={props.resetKey}
        className="form-select form-select-sm dict-dtype-select"
        defaultValue={initial}
        disabled={props.disabled}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          if (!dirty) {
            props.onDone?.();
            return;
          }
          const next = e.target.value;
          props.onSave(next ? next : null);
          setDirty(false);
          props.onDone?.();
        }}
      >
        <option value="">—</option>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {dirty ? <span className="text-muted small">●</span> : null}
    </div>
  );
}

/** ---------- Upload Modal ---------- */
function UploadModal(props: { open: boolean; onClose: () => void; onUploaded: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fullReplace, setFullReplace] = useState(false);

  const uploadM = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please choose a file.");
      return uploadModel(file, fullReplace);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modelColumns"] });
      qc.invalidateQueries({ queryKey: ["modelTables"] });
      props.onUploaded();
      props.onClose();
      setFile(null);
      setFullReplace(false);
    },
  });

  if (!props.open) return null;

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      onMouseDown={props.onClose}
      style={{ background: "rgba(0,0,0,.35)" }}
    >
      <div className="modal-dialog modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload Data Dictionary</h5>
            <button type="button" className="btn-close" onClick={props.onClose} />
          </div>

          <div className="modal-body">
            <div className="vstack gap-2">
              <div className="small text-muted">
                Expected columns: <code>table_name</code>, <code>column_name</code>, <code>data_type</code>,{" "}
                <code>description</code>
              </div>

              <input
                type="file"
                className="form-control"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />

              <div className="form-check">
                <input
                  className="form-check-input"
                  id="fullReplace"
                  type="checkbox"
                  checked={fullReplace}
                  onChange={(e) => setFullReplace(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="fullReplace">
                  Full replace (deactivate missing columns from this upload)
                </label>
              </div>

              {uploadM.isError ? (
                <div className="alert alert-danger py-2 mb-0">{(uploadM.error as Error).message}</div>
              ) : null}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline-secondary btn-sm" onClick={props.onClose}>
              Close
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => uploadM.mutate()}
              disabled={!file || uploadM.isPending}
            >
              {uploadM.isPending ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------- Add Column Modal ---------- */
function AddColumnModal(props: {
  open: boolean;
  tableName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();

  const [columnName, setColumnName] = useState("");
  const [dataType, setDataType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const createM = useMutation({
    mutationFn: async () => {
      const col = columnName.trim();
      if (!props.tableName) throw new Error("Select a table first.");
      if (!col) throw new Error("Column name is required.");

      return createModelColumn({
        tableName: props.tableName,
        columnName: col,
        dataType: dataType ? dataType : null,
        description: description.trim() ? description.trim() : null,
        isActive,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modelColumns"] });
      qc.invalidateQueries({ queryKey: ["modelTables"] });
      setColumnName("");
      setDataType("");
      setDescription("");
      setIsActive(true);
      props.onCreated();
      props.onClose();
    },
  });

  useEffect(() => {
    if (!props.open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={props.onClose} />
      <div
        className="offcanvas offcanvas-end show dict-add-column-offcanvas"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Add Column"
      >
        <div className="offcanvas-header border-bottom">
          <h5 className="offcanvas-title mb-0">Add Column</h5>
          <button type="button" className="btn-close" onClick={props.onClose} />
        </div>
        <div className="offcanvas-body">
          <div className="vstack gap-2">
            <div className="small text-muted">
              Table: <span className="fw-semibold">{props.tableName || "—"}</span>
            </div>

            <div>
              <label className="form-label small mb-1">Column Name</label>
              <input
                className="form-control form-control-sm"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                placeholder="e.g. patient_id"
              />
            </div>

            <div>
              <label className="form-label small mb-1">Data Type</label>
              <select
                className="form-select form-select-sm"
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
              >
                <option value="">—</option>
                {DATA_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label small mb-1">Description</label>
              <textarea
                className="form-control form-control-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this column mean?"
                rows={3}
              />
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                id="newColActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="newColActive">
                Active
              </label>
            </div>

            {createM.isError ? (
              <div className="alert alert-danger py-2 mb-0">{(createM.error as Error).message}</div>
            ) : null}
          </div>
        </div>

        <div className="border-top p-3 d-flex justify-content-end gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => createM.mutate()}
            disabled={createM.isPending}
          >
            {createM.isPending ? "Saving…" : "Add"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/** ---------- Dictionary Tab ---------- */
export const DictionaryTab: React.FC = () => {
  const qc = useQueryClient();

  const [tableFilter, setTableFilter] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [globalSearchDraft, setGlobalSearchDraft] = useState("");
  const globalSearchTerm = globalSearchDraft.trim();
  const debouncedGlobalSearchTerm = useDebouncedValue(globalSearchTerm, GLOBAL_SEARCH_DEBOUNCE_MS);
  const isGlobalSearchMode = globalSearchTerm.length > 0;

  const [isSwitching, startTransition] = useTransition();

  const [qDraft, setQDraft] = useState("");
  const qDeferred = useDeferredValue(qDraft);
  const [activeOnly, setActiveOnly] = useState(true);

  const [editing, setEditing] = useState<{ id: number; field: "dataType" | "description" } | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [jumpToColumn, setJumpToColumn] = useState<{ tableName: string; columnName: string } | null>(null);
  const [pulsedColumnKey, setPulsedColumnKey] = useState<string | null>(null);
  const rowRefMap = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const tableButtonRefMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pulseTimerRef = useRef<number | null>(null);

  // Fetch model tables, derive table names (keeps UI behavior)
  const tableNamesQ = useQuery({
    queryKey: ["modelTables", { q: "" }],
    queryFn: () => fetchModelTables({ q: "", limit: 5000, offset: 0 }),
  });

  const allTableNames = useMemo(() => {
    const rows = tableNamesQ.data?.rows ?? [];
    // Try common shapes: {name}, {table_name}, {tableName}
    const names = rows
      .map((r: any) => String(r?.name ?? r?.table_name ?? r?.tableName ?? "").trim())
      .filter((s: string) => !!s);

    // unique + sort
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [tableNamesQ.data]);

  const filteredTableNames = useMemo(() => {
    const f = tableFilter.trim().toLowerCase();
    if (!f) return allTableNames;
    return allTableNames.filter((t) => t.toLowerCase().includes(f));
  }, [allTableNames, tableFilter]);

  const modelQ = useQuery({
    queryKey: ["modelColumns", { q: qDeferred, selectedTable, activeOnly }],
    enabled: !!selectedTable,
    placeholderData: (prev) => prev,
    queryFn: () =>
      fetchModelColumns({
        q: qDeferred.trim() ? qDeferred : undefined,
        table: selectedTable || undefined,
        active: activeOnly ? true : undefined,
      }),
  });

  const rows: ModelColumnRow[] = selectedTable ? (modelQ.data?.rows ?? []) : [];
  const globalSearchQ = useQuery({
    queryKey: ["modelColumnsGlobalSearch", { q: debouncedGlobalSearchTerm, activeOnly }],
    enabled: !!debouncedGlobalSearchTerm,
    placeholderData: (prev) => prev,
    queryFn: () =>
      searchModelColumns({
        q: debouncedGlobalSearchTerm,
        limit: GLOBAL_SEARCH_LIMIT,
        active: activeOnly ? true : undefined,
      }),
  });

  const globalSearchLower = debouncedGlobalSearchTerm.toLowerCase();
  const globalColumnHits = useMemo(() => {
    const source = globalSearchQ.data?.rows ?? [];
    const filtered = activeOnly ? source.filter((row) => !!row.isActive) : source;
    const seen = new Set<string>();
    const unique: ModelColumnRow[] = [];

    for (const row of filtered) {
      const key = toColumnLookupKey(row.tableName, row.columnName);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
    }
    return unique;
  }, [globalSearchQ.data, activeOnly]);

  const globalTableResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm) return [] as Array<{ tableName: string; matchCount: number }>;

    const matchCounts = new Map<string, number>();
    const tableNamesByLower = new Map<string, string>();

    for (const row of globalColumnHits) {
      const key = row.tableName.toLowerCase();
      if (!tableNamesByLower.has(key)) tableNamesByLower.set(key, row.tableName);

      const colNameMatch = row.columnName.toLowerCase().includes(globalSearchLower);
      const descMatch = (row.description ?? "").toLowerCase().includes(globalSearchLower);
      if (colNameMatch || descMatch) {
        matchCounts.set(key, (matchCounts.get(key) ?? 0) + 1);
      }
    }

    for (const tableName of allTableNames) {
      if (tableName.toLowerCase().includes(globalSearchLower)) {
        const key = tableName.toLowerCase();
        if (!tableNamesByLower.has(key)) tableNamesByLower.set(key, tableName);
      }
    }

    const out = Array.from(tableNamesByLower.entries()).map(([lower, name]) => ({
      tableName: name,
      matchCount: matchCounts.get(lower) ?? 0,
      nameMatch: lower.includes(globalSearchLower),
    }));

    out.sort((a, b) => {
      if (a.nameMatch !== b.nameMatch) return a.nameMatch ? -1 : 1;
      if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      return a.tableName.localeCompare(b.tableName);
    });

    return out.map(({ tableName, matchCount }) => ({ tableName, matchCount }));
  }, [allTableNames, globalColumnHits, globalSearchLower, debouncedGlobalSearchTerm]);

  const globalColumnResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm) return [] as ModelColumnRow[];

    const filtered = globalColumnHits.filter((row) => {
      const inTable = row.tableName.toLowerCase().includes(globalSearchLower);
      const inColumn = row.columnName.toLowerCase().includes(globalSearchLower);
      const inDescription = (row.description ?? "").toLowerCase().includes(globalSearchLower);
      return inTable || inColumn || inDescription;
    });

    filtered.sort((a, b) => {
      const tableCmp = a.tableName.localeCompare(b.tableName);
      if (tableCmp !== 0) return tableCmp;
      return a.columnName.localeCompare(b.columnName);
    });

    return filtered;
  }, [debouncedGlobalSearchTerm, globalColumnHits, globalSearchLower]);

  const showGlobalSearching =
    isGlobalSearchMode && (debouncedGlobalSearchTerm !== globalSearchTerm || globalSearchQ.isFetching);

  const patchM = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<Pick<ModelColumnRow, "dataType" | "description" | "isActive">>;
    }) => patchModelColumn(id, patch),
    onMutate: async ({ id, patch }) => {
      const key = ["modelColumns", { q: qDeferred, selectedTable, activeOnly }] as const;

      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ rows: ModelColumnRow[] }>(key);

      if (prev?.rows) {
        qc.setQueryData(key, { rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
      }

      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["modelColumns"] });
      qc.invalidateQueries({ queryKey: ["modelTables"] });
    },
  });

  const columns = useMemo<ColumnDef<ModelColumnRow>[]>(() => {
    return [
      {
        header: "Column",
        accessorKey: "columnName",
        meta: { className: "col-colname" },
        cell: ({ row }) => (
          <div className="text-truncate" title={row.original.columnName}>
            {row.original.columnName}
          </div>
        ),
      },
      {
        header: "Data Type",
        accessorKey: "dataType",
        meta: { className: "col-dtype" },
        cell: ({ row }) => {
          const isEditing = editing?.id === row.original.id && editing.field === "dataType";
          if (!isEditing) {
            const label = row.original.dataType ?? "—";
            return (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                onClick={() => setEditing({ id: row.original.id, field: "dataType" })}
                disabled={patchM.isPending}
                title="Click to edit"
              >
                {label}
              </button>
            );
          }

          return (
            <DataTypeSelect
              value={row.original.dataType ?? null}
              options={DATA_TYPE_OPTIONS}
              disabled={patchM.isPending}
              resetKey={`${row.original.id}:${row.original.dataType ?? ""}`}
              onDone={() => setEditing(null)}
              onSave={(next) =>
                patchM.mutate({
                  id: row.original.id,
                  patch: { dataType: next },
                })
              }
            />
          );
        },
      },
      {
        header: "Description",
        accessorKey: "description",
        meta: { className: "col-desc" },
        cell: ({ row }) => {
          const isEditing = editing?.id === row.original.id && editing.field === "description";
          if (!isEditing) {
            const text = (row.original.description ?? "").trim();
            const preview = text ? (text.length > 80 ? `${text.slice(0, 80)}…` : text) : "—";
            return (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none text-start w-100 dict-desc-button"
                onClick={() => setEditing({ id: row.original.id, field: "description" })}
                disabled={patchM.isPending}
                title="Click to edit"
              >
                <span className="text-truncate d-block">{preview}</span>
              </button>
            );
          }

          return (
            <InlineTextArea
              value={row.original.description ?? ""}
              placeholder="Describe what this column means…"
              disabled={patchM.isPending}
              resetKey={`${row.original.id}:${row.original.description ?? ""}`}
              onDone={() => setEditing(null)}
              onSave={(next) =>
                patchM.mutate({
                  id: row.original.id,
                  patch: { description: next.trim() ? next : null },
                })
              }
            />
          );
        },
      },
      {
        header: "Active",
        accessorKey: "isActive",
        meta: { className: "col-active" },
        cell: ({ row }) => (
          <div className="form-check m-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={!!row.original.isActive}
              disabled={patchM.isPending}
              onChange={(e) => {
                const nextIsActive = e.target.checked;
                // Keep the just-deactivated row visible instead of filtering it out immediately.
                if (!nextIsActive && activeOnly) {
                  setActiveOnly(false);
                }
                patchM.mutate({ id: row.original.id, patch: { isActive: nextIsActive } });
              }}
            />
          </div>
        ),
      },
    ];
  }, [patchM.isPending, editing, activeOnly]);

  const tableInst = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const pagination = tableInst.getState().pagination;

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!jumpToColumn || !selectedTable) return;

    const selectedLower = selectedTable.toLowerCase();
    const targetTableLower = jumpToColumn.tableName.toLowerCase();
    if (selectedLower !== targetTableLower) return;

    const targetIndex = rows.findIndex(
      (row) => row.columnName.toLowerCase() === jumpToColumn.columnName.toLowerCase()
    );
    if (targetIndex < 0) return;

    const nextPage = Math.floor(targetIndex / pagination.pageSize);
    if (pagination.pageIndex !== nextPage) {
      tableInst.setPageIndex(nextPage);
      return;
    }

    const key = toColumnLookupKey(selectedTable, jumpToColumn.columnName);
    const rowEl = rowRefMap.current.get(key);
    if (!rowEl) return;

    rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulsedColumnKey(key);

    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => {
      setPulsedColumnKey((current) => (current === key ? null : current));
    }, 2000);

    setJumpToColumn(null);
  }, [jumpToColumn, selectedTable, rows, pagination.pageIndex, pagination.pageSize, tableInst]);

  useEffect(() => {
    if (!selectedTable || isGlobalSearchMode) return;

    // Make sure selected table is visible in the filtered list.
    if (tableFilter && !filteredTableNames.includes(selectedTable)) {
      setTableFilter("");
      return;
    }

    const btn = tableButtonRefMap.current.get(selectedTable);
    if (!btn) return;

    window.requestAnimationFrame(() => {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selectedTable, isGlobalSearchMode, tableFilter, filteredTableNames]);

  const statusText =
    patchM.isPending ? "Saving…" :
    isSwitching ? "Switching…" :
    (selectedTable && modelQ.isFetching ? "Refreshing…" : "");

  return (
    <div className="p-3">
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
        <div>
          <div className="fw-bold">Dictionary</div>
          <div className="text-muted small">
            Select a table on the left, then edit column metadata on the right.
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => modelQ.refetch()} disabled={!selectedTable}>
            Refresh
          </button>

          <button className="btn btn-outline-primary btn-sm" onClick={() => setAddOpen(true)} disabled={!selectedTable}>
            Add Column
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
            Upload
          </button>
        </div>
      </div>

      <hr className="my-3" />

      <div className="row g-3">
        <div className="col-12 col-lg-3">
          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <div className="fw-semibold">Tables</div>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setEditing(null);
                  startTransition(() => setSelectedTable(""));
                }}
                disabled={!selectedTable}
                title="Clear selection"
              >
                All
              </button>
            </div>

            <div className="card-body p-2">
              <div className="input-group input-group-sm mb-1">
                <span className="input-group-text bg-white">
                  <i className="fa fa-search text-muted" aria-hidden="true" />
                </span>
                <input
                  className="form-control"
                  value={globalSearchDraft}
                  onChange={(e) => setGlobalSearchDraft(e.target.value)}
                  placeholder="Search tables & columns..."
                  aria-label="Global dictionary search"
                />
              </div>
              <div className="text-muted small mb-2">
                Search across table names, columns, and descriptions.
              </div>

              <input
                className="form-control form-control-sm mb-2"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter tables…"
              />

              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  id="activeOnly"
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="activeOnly">
                  Active only
                </label>
              </div>

              {tableNamesQ.isError ? (
                <div className="alert alert-danger py-2 mb-0">{(tableNamesQ.error as Error).message}</div>
              ) : null}

              {isGlobalSearchMode ? (
                <div className="dict-global-results">
                  {showGlobalSearching ? (
                    <div className="text-muted small p-2">Searching…</div>
                  ) : globalSearchQ.isError ? (
                    <div className="alert alert-danger py-2 mb-0">{(globalSearchQ.error as Error).message}</div>
                  ) : globalTableResults.length === 0 && globalColumnResults.length === 0 ? (
                    <div className="dict-global-empty">
                      <div className="fw-semibold">No matches for “{globalSearchTerm}”</div>
                      <div className="text-muted small">
                        Try a different term, or search by a partial column name.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="dict-global-group">
                        <div className="dict-global-group-title">Tables</div>
                        {globalTableResults.length === 0 ? (
                          <div className="text-muted small p-2">No table matches.</div>
                        ) : (
                          <div className="list-group">
                            {globalTableResults.map((result) => (
                              <button
                                key={`tbl-${result.tableName}`}
                                type="button"
                                className="list-group-item list-group-item-action dict-global-item"
                                onClick={() => {
                                  setEditing(null);
                                  setJumpToColumn(null);
                                  setTableFilter("");
                                  setGlobalSearchDraft("");
                                  startTransition(() => setSelectedTable(result.tableName));
                                }}
                                title={result.tableName}
                              >
                                <div className="d-flex justify-content-between align-items-center gap-2">
                                  <span className="text-truncate">
                                    {renderHighlightedText(result.tableName, debouncedGlobalSearchTerm)}
                                  </span>
                                  <span className="badge text-bg-light border">
                                    {result.matchCount}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="dict-global-group mt-2">
                        <div className="dict-global-group-title">Columns</div>
                        {globalColumnResults.length === 0 ? (
                          <div className="text-muted small p-2">No column matches.</div>
                        ) : (
                          <div className="list-group">
                            {globalColumnResults.slice(0, GLOBAL_SEARCH_LIMIT).map((result) => {
                              const label = `${result.tableName}.${result.columnName}`;
                              const snippet = buildDescriptionSnippet(
                                result.description,
                                debouncedGlobalSearchTerm
                              );

                              return (
                                <button
                                  key={`col-${toColumnLookupKey(result.tableName, result.columnName)}`}
                                  type="button"
                                  className="list-group-item list-group-item-action dict-global-item"
                                  onClick={() => {
                                    setEditing(null);
                                    setQDraft("");
                                    setTableFilter("");
                                    setGlobalSearchDraft("");
                                    setJumpToColumn({
                                      tableName: result.tableName,
                                      columnName: result.columnName,
                                    });
                                    startTransition(() => setSelectedTable(result.tableName));
                                  }}
                                  title={label}
                                >
                                  <div className="fw-semibold text-truncate">
                                    {renderHighlightedText(label, debouncedGlobalSearchTerm)}
                                  </div>
                                  {snippet ? (
                                    <div className="dict-global-desc">
                                      {renderHighlightedText(snippet, debouncedGlobalSearchTerm)}
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="list-group" style={{ maxHeight: 520, overflowY: "auto" }}>
                    {tableNamesQ.isLoading ? (
                      <div className="text-muted small p-2">Loading tables…</div>
                    ) : filteredTableNames.length === 0 ? (
                      <div className="text-muted small p-2">No matching tables.</div>
                    ) : (
                      filteredTableNames.map((t) => {
                        const active = t === selectedTable;
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`list-group-item list-group-item-action py-2 ${active ? "active" : ""}`}
                            ref={(node) => {
                              if (node) tableButtonRefMap.current.set(t, node);
                              else tableButtonRefMap.current.delete(t);
                            }}
                            onClick={() => {
                              setEditing(null);
                              startTransition(() => setSelectedTable(t));
                            }}
                            title={t}
                          >
                            <span className="text-truncate d-block">{t}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="text-muted small mt-2">
                    Showing {filteredTableNames.length} / {allTableNames.length}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-9">
          <div className="card">
            <div className="card-header py-2">
              <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                <div className="dict-selected-table-title">
                  {selectedTable || "Select a table"}
                </div>

                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <div className="input-group input-group-sm" style={{ width: 360 }}>
                    <span className="input-group-text bg-white">
                      <i className="fa fa-search text-muted" aria-hidden="true" />
                    </span>
                    <input
                      className="form-control"
                      value={qDraft}
                      onChange={(e) => setQDraft(e.target.value)}
                      placeholder="Search columns (name / description)…"
                      disabled={!selectedTable}
                    />
                  </div>

                  <div className="text-muted small text-end" style={{ minWidth: 110 }}>
                    <span style={{ visibility: statusText ? "visible" : "hidden" }}>{statusText || "…"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body p-0">
              {!selectedTable ? (
                <div className="p-3">
                  <EmptySectionState
                    iconClass="fa-table"
                    title="Select a table"
                    subtitle="Click a table on the left to load and edit its columns."
                    ctaLabel="Select"
                    onClick={() => {}}
                  />
                </div>
              ) : (
                <>
                  {modelQ.isError ? (
                    <div className="alert alert-danger m-3 py-2">{(modelQ.error as Error).message}</div>
                  ) : null}

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0 dict-table">
                      <thead className="dict-thead">
                        {tableInst.getHeaderGroups().map((hg) => (
                          <tr key={hg.id}>
                            {hg.headers.map((h) => {
                              const cls = (h.column.columnDef.meta as any)?.className ?? "";
                              return (
                                <th key={h.id} className={`px-3 py-2 ${cls}`}>
                                  {flexRender(h.column.columnDef.header, h.getContext())}
                                </th>
                              );
                            })}
                          </tr>
                        ))}
                      </thead>

                      <tbody>
                        {modelQ.isLoading ? (
                          <tr>
                            <td colSpan={columns.length} className="px-3 py-3">
                              Loading…
                            </td>
                          </tr>
                        ) : tableInst.getRowModel().rows.length === 0 ? (
                          <tr>
                            <td colSpan={columns.length} className="px-3 py-3">
                              No results.
                            </td>
                          </tr>
                        ) : (
                          tableInst.getRowModel().rows.map((r) => {
                            const rowTable = selectedTable || r.original.tableName || "";
                            const rowKey = toColumnLookupKey(rowTable, r.original.columnName);
                            const pulsing = pulsedColumnKey === rowKey;

                            return (
                              <tr
                                key={r.id}
                                className={pulsing ? "dict-column-pulse" : ""}
                                ref={(node) => {
                                  if (node) rowRefMap.current.set(rowKey, node);
                                  else rowRefMap.current.delete(rowKey);
                                }}
                              >
                                {r.getVisibleCells().map((c) => {
                                  const cls = (c.column.columnDef.meta as any)?.className ?? "";
                                  return (
                                    <td key={c.id} className={`px-3 py-2 ${cls}`}>
                                      {flexRender(c.column.columnDef.cell, c.getContext())}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-between align-items-center p-2 border-top">
                    <div className="text-muted small">Rows: {rows.length.toLocaleString()}</div>

                    <div className="d-flex gap-2 align-items-center">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => tableInst.previousPage()}
                        disabled={!tableInst.getCanPreviousPage()}
                      >
                        Prev
                      </button>

                      <div className="text-muted small">
                        Page {tableInst.getState().pagination.pageIndex + 1} of {tableInst.getPageCount() || 1}
                      </div>

                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => tableInst.nextPage()}
                        disabled={!tableInst.getCanNextPage()}
                      >
                        Next
                      </button>

                      <select
                        className="form-select form-select-sm"
                        style={{ width: 120 }}
                        value={tableInst.getState().pagination.pageSize}
                        onChange={(e) => tableInst.setPageSize(Number(e.target.value))}
                      >
                        {[25, 50, 100, 200].map((n) => (
                          <option key={n} value={n}>
                            {n}/page
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={() => {}} />
      <AddColumnModal
        open={addOpen}
        tableName={selectedTable}
        onClose={() => setAddOpen(false)}
        onCreated={() => {}}
      />
    </div>
  );
};
