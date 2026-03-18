import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  WorkspaceDictionaryColumn,
  fetchColumnSample,
  fetchDictionaryColumns,
  fetchDictionaryTables,
  importDictionary,
  patchDictionaryColumn,
  searchDictionaryColumns,
} from "../../../../shared/services/queryStudioAdminApi";
import type { DomainColumnRef } from "../../../query-forge/model/domainCatalog";
import { ColumnPreviewDrawer } from "../../../query-forge/ui/components/ColumnPreviewDrawer";

import { EmptySectionState } from "../../../../shared/components/EmptySectionState";
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
    ),
  );
}

function buildDescriptionSnippet(
  description: string | null | undefined,
  query: string,
  maxLen = 110,
) {
  const source = (description ?? "").trim();
  if (!source) return null;
  if (!query)
    return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;

  const lower = source.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);

  if (idx < 0)
    return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;

  const contextBefore = 24;
  const contextAfter = maxLen - query.length - contextBefore;
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(
    source.length,
    idx + query.length + Math.max(24, contextAfter),
  );
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

function toColumnLookupKey(tableName: string, columnName: string) {
  return `${tableName}::${columnName}`.toLowerCase();
}

type PreviewState = { col: DomainColumnRef } | null;

function toPreviewColumn(row: WorkspaceDictionaryColumn): DomainColumnRef {
  const raw = row as WorkspaceDictionaryColumn & Record<string, unknown>;
  const workspaceTableId = row.workspace_table_id;
  const domainId = Number((raw as any).domainId ?? (raw as any).domain_id ?? 0);

  return {
    modelColumnId: row.id || null,
    identityKey:
      `dict:${row.id}:${row.table_name ?? ""}:${row.column_name}`.toLowerCase(),
    columnName: row.column_name,
    modelTableName: row.table_name ?? "",
    fullName: String(
      (raw as any).fullName ??
        (raw as any).full_name ??
        `${row.table_name ?? ""}.${row.column_name}`,
    ),
    tableAlias: null,
    columnLabel: null,
    dataType: row.data_type ?? "unknown",
    nullable: true,
    description: row.description,
    workspaceTableId,
    modelTableId: null,
    baseTableName: row.table_name ?? "",
    schemaName: String((raw as any).schema_name ?? ""),
    catalogName: String((raw as any).catalog_name ?? ""),
    domainId,
    domainName: "Data Dictionary",
    variantCode: null,
    isQe: false,
    existsInDbx: false,
    lastSeenAt: row.sample_ran_at ?? null,
    ordinalPosition: row.ordinal_position ?? undefined,
    sampleValues: row.sample_values_json,
    sampleStats: row.sample_stats_json,
    sampleRanAt: row.sample_ran_at,
    sampleError: row.sample_error,
    tableColumnCount: undefined,
  };
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
function UploadModal(props: {
  open: boolean;
  onClose: () => void;
  onUploaded: (result: {
    updated: number;
    unmatched: Array<{ table_name: string; column_name: string }>;
  }) => void;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fullReplace, setFullReplace] = useState(false);

  const uploadM = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please choose a file.");
      return importDictionary(file, fullReplace);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["dictColumns"] });
      qc.invalidateQueries({ queryKey: ["dictTables"] });
      props.onUploaded(data);
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
      <div
        className="modal-dialog modal-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload Data Dictionary</h5>
            <button
              type="button"
              className="btn-close"
              onClick={props.onClose}
            />
          </div>

          <div className="modal-body">
            <div className="vstack gap-2">
              <div className="small text-muted">
                Expected columns: <code>table_name</code>,{" "}
                <code>column_name</code>, <code>data_type</code>,{" "}
                <code>description</code>
              </div>

              <label htmlFor="dictUploadFile" className="form-label">
                File
              </label>
              <input
                id="dictUploadFile"
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
                  Full replace (clear all descriptions and data types before
                  applying)
                </label>
              </div>

              {uploadM.isError ? (
                <div className="alert alert-danger py-2 mb-0">
                  {(uploadM.error as Error).message}
                </div>
              ) : null}
            </div>
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={props.onClose}
            >
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

/** ---------- Dictionary Tab ---------- */
export const DictionaryTab: React.FC = () => {
  const qc = useQueryClient();

  const [tableFilter, setTableFilter] = useState("");
  const [selectedTable, setSelectedTable] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [globalSearchDraft, setGlobalSearchDraft] = useState("");
  const globalSearchTerm = globalSearchDraft.trim();
  const debouncedGlobalSearchTerm = useDebouncedValue(
    globalSearchTerm,
    GLOBAL_SEARCH_DEBOUNCE_MS,
  );
  const isGlobalSearchMode = globalSearchTerm.length > 0;

  const [isSwitching, startTransition] = useTransition();

  const [qDraft, setQDraft] = useState("");
  const qDeferred = useDeferredValue(qDraft);
  const [activeOnly, setActiveOnly] = useState(true);

  const [editing, setEditing] = useState<{
    id: number;
    field: "data_type" | "description";
  } | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [importUnmatched, setImportUnmatched] = useState<
    Array<{ table_name: string; column_name: string }>
  >([]);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [jumpToColumn, setJumpToColumn] = useState<{
    tableName: string;
    columnName: string;
  } | null>(null);
  const [pulsedColumnKey, setPulsedColumnKey] = useState<string | null>(null);
  const rowRefMap = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const tableButtonRefMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pulseTimerRef = useRef<number | null>(null);

  // Fetch dictionary tables
  const tableNamesQ = useQuery({
    queryKey: ["dictTables", { q: "" }],
    queryFn: () => fetchDictionaryTables({ q: "", limit: 5000, offset: 0 }),
  });

  const allTableNames = useMemo(() => {
    const rows = tableNamesQ.data?.rows ?? [];
    const seen = new Set<number>();
    const result: Array<{ id: number; name: string }> = [];
    for (const r of rows as any[]) {
      const id = Number(r?.id);
      const name = String(r?.table_name ?? "").trim();
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, name });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tableNamesQ.data]);

  const filteredTableNames = useMemo(() => {
    const f = tableFilter.trim().toLowerCase();
    if (!f) return allTableNames;
    return allTableNames.filter((t) => t.name.toLowerCase().includes(f));
  }, [allTableNames, tableFilter]);

  const modelQ = useQuery({
    queryKey: [
      "dictColumns",
      { workspace_table_id: selectedTable?.id, activeOnly },
    ],
    enabled: !!selectedTable,
    placeholderData: (prev) => prev,
    queryFn: () =>
      fetchDictionaryColumns({
        workspace_table_id: selectedTable!.id,
        q: qDeferred.trim() ? qDeferred : undefined,
        active_only: activeOnly,
      }),
  });

  const rows: WorkspaceDictionaryColumn[] = selectedTable
    ? (modelQ.data?.rows ?? [])
    : [];

  const globalSearchQ = useQuery({
    queryKey: [
      "dictColumnsGlobalSearch",
      { q: debouncedGlobalSearchTerm, activeOnly },
    ],
    enabled: !!debouncedGlobalSearchTerm,
    placeholderData: (prev) => prev,
    queryFn: () =>
      searchDictionaryColumns({
        q: debouncedGlobalSearchTerm,
        limit: GLOBAL_SEARCH_LIMIT,
        active_only: activeOnly,
      }),
  });

  const globalSearchLower = debouncedGlobalSearchTerm.toLowerCase();

  const globalColumnHits = useMemo(() => {
    const source = globalSearchQ.data?.rows ?? [];
    const filtered = activeOnly
      ? source.filter((row) => !!row.is_active)
      : source;
    const seen = new Set<string>();
    const unique: WorkspaceDictionaryColumn[] = [];
    for (const row of filtered) {
      const key = toColumnLookupKey(row.table_name ?? "", row.column_name);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
    }
    return unique;
  }, [globalSearchQ.data, activeOnly]);

  const globalTableResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm)
      return [] as Array<{ id: number; tableName: string; matchCount: number }>;

    const matchCounts = new Map<string, number>();
    const tableEntriesByLower = new Map<string, { id: number; name: string }>();

    for (const row of globalColumnHits) {
      const key = (row.table_name ?? "").toLowerCase();
      if (!tableEntriesByLower.has(key)) {
        const found = allTableNames.find((t) => t.name.toLowerCase() === key);
        tableEntriesByLower.set(key, {
          id: found?.id ?? row.workspace_table_id,
          name: row.table_name ?? "",
        });
      }
      const colNameMatch = row.column_name
        .toLowerCase()
        .includes(globalSearchLower);
      const descMatch = (row.description ?? "")
        .toLowerCase()
        .includes(globalSearchLower);
      if (colNameMatch || descMatch) {
        matchCounts.set(key, (matchCounts.get(key) ?? 0) + 1);
      }
    }

    for (const t of allTableNames) {
      if (t.name.toLowerCase().includes(globalSearchLower)) {
        const key = t.name.toLowerCase();
        if (!tableEntriesByLower.has(key)) {
          tableEntriesByLower.set(key, { id: t.id, name: t.name });
        }
      }
    }

    const out = Array.from(tableEntriesByLower.entries()).map(
      ([lower, entry]) => ({
        id: entry.id,
        tableName: entry.name,
        matchCount: matchCounts.get(lower) ?? 0,
        nameMatch: lower.includes(globalSearchLower),
      }),
    );

    out.sort((a, b) => {
      if (a.nameMatch !== b.nameMatch) return a.nameMatch ? -1 : 1;
      if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      return a.tableName.localeCompare(b.tableName);
    });

    return out.map(({ id, tableName, matchCount }) => ({
      id,
      tableName,
      matchCount,
    }));
  }, [
    allTableNames,
    globalColumnHits,
    globalSearchLower,
    debouncedGlobalSearchTerm,
  ]);

  const globalColumnResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm) return [] as WorkspaceDictionaryColumn[];

    const filtered = globalColumnHits.filter((row) => {
      const inTable = (row.table_name ?? "")
        .toLowerCase()
        .includes(globalSearchLower);
      const inColumn = row.column_name
        .toLowerCase()
        .includes(globalSearchLower);
      const inDescription = (row.description ?? "")
        .toLowerCase()
        .includes(globalSearchLower);
      return inTable || inColumn || inDescription;
    });

    filtered.sort((a, b) => {
      const tableCmp = (a.table_name ?? "").localeCompare(b.table_name ?? "");
      if (tableCmp !== 0) return tableCmp;
      return a.column_name.localeCompare(b.column_name);
    });

    return filtered;
  }, [debouncedGlobalSearchTerm, globalColumnHits, globalSearchLower]);

  const showGlobalSearching =
    isGlobalSearchMode &&
    (debouncedGlobalSearchTerm !== globalSearchTerm ||
      globalSearchQ.isFetching);

  const patchM = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<
        Pick<
          WorkspaceDictionaryColumn,
          "data_type" | "description" | "is_active"
        >
      >;
    }) => patchDictionaryColumn(id, patch),
    onMutate: async ({ id, patch }) => {
      // Snapshot the key at mutation time. If activeOnly changes mid-flight, the
      // rollback may be a no-op; onSettled's full invalidation corrects the cache.
      const key = [
        "dictColumns",
        { workspace_table_id: selectedTable?.id, activeOnly },
      ];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ rows: WorkspaceDictionaryColumn[] }>(key);
      if (prev?.rows) {
        qc.setQueryData(key, {
          rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        });
      }
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      // Restore optimistic update. If activeOnly changed mid-flight, ctx.key may not
      // match the live cache entry — onSettled's invalidation will correct that.
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["dictColumns"] });
      qc.invalidateQueries({ queryKey: ["dictTables"] });
    },
  });

  const openPreview = useCallback((row: WorkspaceDictionaryColumn) => {
    const previewCol = toPreviewColumn(row);
    setPreview({ col: previewCol });

    const wsTableId = row.workspace_table_id;
    if (!wsTableId) return;

    fetchColumnSample({
      workspace_table_id: wsTableId,
      column_name: row.column_name,
      limit: 50,
    })
      .then((sample) => {
        setPreview((current) => {
          if (!current || current.col.identityKey !== previewCol.identityKey)
            return current;
          return {
            col: {
              ...current.col,
              sampleValues: sample.values ?? current.col.sampleValues,
              sampleStats: sample.sampleStatsJson ?? current.col.sampleStats,
              sampleRanAt: sample.sampleRanAt ?? current.col.sampleRanAt,
              sampleError: sample.error ?? current.col.sampleError,
            },
          };
        });
      })
      .catch(() => {
        setPreview((current) => {
          if (!current || current.col.identityKey !== previewCol.identityKey)
            return current;
          return {
            col: { ...current.col, sampleError: "Failed to load sample data." },
          };
        });
      });
  }, []);

  const columns = useMemo<ColumnDef<WorkspaceDictionaryColumn>[]>(() => {
    return [
      {
        header: "Column",
        accessorKey: "column_name",
        meta: { className: "col-colname" },
        cell: ({ row }) => (
          <div className="text-truncate" title={row.original.column_name}>
            {row.original.column_name}
          </div>
        ),
      },
      {
        header: "Data Type",
        accessorKey: "data_type",
        meta: { className: "col-dtype" },
        cell: ({ row }) => {
          const isEditing =
            editing?.id === row.original.id && editing.field === "data_type";
          if (!isEditing) {
            const label = row.original.data_type ?? "—";
            return (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                onClick={() =>
                  setEditing({ id: row.original.id, field: "data_type" })
                }
                disabled={patchM.isPending}
                title="Click to edit"
              >
                {label}
              </button>
            );
          }

          return (
            <DataTypeSelect
              value={row.original.data_type ?? null}
              options={DATA_TYPE_OPTIONS}
              disabled={patchM.isPending}
              resetKey={`${row.original.id}:${row.original.data_type ?? ""}`}
              onDone={() => setEditing(null)}
              onSave={(next) =>
                patchM.mutate({
                  id: row.original.id,
                  patch: { data_type: next },
                })
              }
            />
          );
        },
      },
      {
        header: "Preview",
        id: "previewData",
        meta: { className: "col-preview" },
        cell: ({ row }) => (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none dict-preview-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openPreview(row.original);
            }}
          >
            Preview data
          </button>
        ),
      },
      {
        header: "Description",
        accessorKey: "description",
        meta: { className: "col-desc" },
        cell: ({ row }) => {
          const isEditing =
            editing?.id === row.original.id && editing.field === "description";
          if (!isEditing) {
            const text = (row.original.description ?? "").trim();
            const previewText = text
              ? text.length > 80
                ? `${text.slice(0, 80)}…`
                : text
              : "—";
            return (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none text-start w-100 dict-desc-button"
                onClick={() =>
                  setEditing({ id: row.original.id, field: "description" })
                }
                disabled={patchM.isPending}
                title="Click to edit"
              >
                <span className="text-truncate d-block">{previewText}</span>
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
        accessorKey: "is_active",
        meta: { className: "col-active" },
        cell: ({ row }) => (
          <div className="form-check m-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={!!row.original.is_active}
              disabled={patchM.isPending}
              onChange={(e) => {
                const nextIsActive = e.target.checked;
                // Keep the just-deactivated row visible instead of filtering it out immediately.
                if (!nextIsActive && activeOnly) {
                  setActiveOnly(false);
                }
                patchM.mutate({
                  id: row.original.id,
                  patch: { is_active: nextIsActive },
                });
              }}
            />
          </div>
        ),
      },
    ];
  }, [patchM.isPending, editing, activeOnly, openPreview]);

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
      if (pulseTimerRef.current !== null)
        window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!jumpToColumn || !selectedTable) return;

    const selectedLower = selectedTable.name.toLowerCase();
    const targetTableLower = jumpToColumn.tableName.toLowerCase();
    if (selectedLower !== targetTableLower) return;

    const targetIndex = rows.findIndex(
      (row) =>
        row.column_name.toLowerCase() === jumpToColumn.columnName.toLowerCase(),
    );
    if (targetIndex < 0) return;

    const nextPage = Math.floor(targetIndex / pagination.pageSize);
    if (pagination.pageIndex !== nextPage) {
      tableInst.setPageIndex(nextPage);
      return;
    }

    const key = toColumnLookupKey(selectedTable.name, jumpToColumn.columnName);
    const rowEl = rowRefMap.current.get(key);
    if (!rowEl) return;

    rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulsedColumnKey(key);
    if (pulseTimerRef.current !== null)
      window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => {
      setPulsedColumnKey((current) => (current === key ? null : current));
    }, 2000);
    setJumpToColumn(null);
  }, [
    jumpToColumn,
    selectedTable,
    rows,
    pagination.pageIndex,
    pagination.pageSize,
    tableInst,
  ]);

  useEffect(() => {
    if (!selectedTable || isGlobalSearchMode) return;

    if (
      tableFilter &&
      !filteredTableNames.some((t) => t.id === selectedTable.id)
    ) {
      setTableFilter("");
      return;
    }

    const btn = tableButtonRefMap.current.get(selectedTable.name);
    if (!btn) return;
    window.requestAnimationFrame(() => {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selectedTable, isGlobalSearchMode, tableFilter, filteredTableNames]);

  const statusText = patchM.isPending
    ? "Saving…"
    : isSwitching
      ? "Switching…"
      : selectedTable && modelQ.isFetching
        ? "Refreshing…"
        : "";

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
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => modelQ.refetch()}
            disabled={!selectedTable}
          >
            Refresh
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setUploadOpen(true)}
            disabled={uploadOpen}
            aria-hidden={uploadOpen || undefined}
          >
            Upload
          </button>
        </div>
      </div>

      <hr className="my-3" />

      {importUnmatched.length > 0 && (
        <div
          className="alert alert-warning alert-dismissible fade show mt-2"
          role="alert"
        >
          {importUnmatched.length} column(s) in your file weren&apos;t found in
          the workspace. Run a catalog sync to import source columns first.
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setImportUnmatched([])}
          />
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-3">
          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <div className="fw-semibold">Tables</div>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setEditing(null);
                  startTransition(() => setSelectedTable(null));
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
                <div className="alert alert-danger py-2 mb-0">
                  {(tableNamesQ.error as Error).message}
                </div>
              ) : null}

              {isGlobalSearchMode ? (
                <div className="dict-global-results">
                  {showGlobalSearching ? (
                    <div className="text-muted small p-2">Searching…</div>
                  ) : globalSearchQ.isError ? (
                    <div className="alert alert-danger py-2 mb-0">
                      {(globalSearchQ.error as Error).message}
                    </div>
                  ) : globalTableResults.length === 0 &&
                    globalColumnResults.length === 0 ? (
                    <div className="dict-global-empty">
                      <div className="fw-semibold">
                        No matches for "{globalSearchTerm}"
                      </div>
                      <div className="text-muted small">
                        Try a different term, or search by a partial column
                        name.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="dict-global-group">
                        <div className="dict-global-group-title">Tables</div>
                        {globalTableResults.length === 0 ? (
                          <div className="text-muted small p-2">
                            No table matches.
                          </div>
                        ) : (
                          <div className="list-group">
                            {globalTableResults.map((result) => (
                              <button
                                key={`tbl-${result.id}`}
                                type="button"
                                className="list-group-item list-group-item-action dict-global-item"
                                onClick={() => {
                                  setEditing(null);
                                  setJumpToColumn(null);
                                  setTableFilter("");
                                  setGlobalSearchDraft("");
                                  startTransition(() =>
                                    setSelectedTable({
                                      id: result.id,
                                      name: result.tableName,
                                    }),
                                  );
                                }}
                                title={result.tableName}
                              >
                                <div className="d-flex justify-content-between align-items-center gap-2">
                                  <span className="text-truncate">
                                    {renderHighlightedText(
                                      result.tableName,
                                      debouncedGlobalSearchTerm,
                                    )}
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
                          <div className="text-muted small p-2">
                            No column matches.
                          </div>
                        ) : (
                          <div className="list-group">
                            {globalColumnResults
                              .slice(0, GLOBAL_SEARCH_LIMIT)
                              .map((result) => {
                                const label = `${result.table_name ?? ""}.${result.column_name}`;
                                const snippet = buildDescriptionSnippet(
                                  result.description,
                                  debouncedGlobalSearchTerm,
                                );

                                return (
                                  <button
                                    key={`col-${toColumnLookupKey(result.table_name ?? "", result.column_name)}`}
                                    type="button"
                                    className="list-group-item list-group-item-action dict-global-item"
                                    onClick={() => {
                                      setEditing(null);
                                      setQDraft("");
                                      setTableFilter("");
                                      setGlobalSearchDraft("");
                                      setJumpToColumn({
                                        tableName: result.table_name ?? "",
                                        columnName: result.column_name,
                                      });
                                      startTransition(() =>
                                        setSelectedTable({
                                          id: result.workspace_table_id,
                                          name: result.table_name ?? "",
                                        }),
                                      );
                                    }}
                                    title={label}
                                  >
                                    <div className="fw-semibold text-truncate">
                                      {renderHighlightedText(
                                        label,
                                        debouncedGlobalSearchTerm,
                                      )}
                                    </div>
                                    {snippet ? (
                                      <div className="dict-global-desc">
                                        {renderHighlightedText(
                                          snippet,
                                          debouncedGlobalSearchTerm,
                                        )}
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
                  <div
                    className="list-group"
                    style={{ maxHeight: 520, overflowY: "auto" }}
                  >
                    {tableNamesQ.isLoading ? (
                      <div className="text-muted small p-2">
                        Loading tables…
                      </div>
                    ) : filteredTableNames.length === 0 ? (
                      <div className="text-muted small p-2">
                        No matching tables.
                      </div>
                    ) : (
                      filteredTableNames.map((t) => {
                        const active = selectedTable?.id === t.id;
                        return (
                          <button
                            key={`tbl-${t.id}`}
                            ref={(el) => {
                              if (el) tableButtonRefMap.current.set(t.name, el);
                              else tableButtonRefMap.current.delete(t.name);
                            }}
                            type="button"
                            className={`list-group-item list-group-item-action${active ? " active" : ""}`}
                            onClick={() => {
                              setEditing(null);
                              setJumpToColumn(null);
                              setQDraft("");
                              startTransition(() => setSelectedTable(t));
                            }}
                            title={t.name}
                          >
                            <span className="text-truncate">{t.name}</span>
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
                  {selectedTable?.name || "Select a table"}
                </div>

                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <div
                    className="input-group input-group-sm"
                    style={{ width: 360 }}
                  >
                    <span className="input-group-text bg-white">
                      <i
                        className="fa fa-search text-muted"
                        aria-hidden="true"
                      />
                    </span>
                    <input
                      className="form-control"
                      value={qDraft}
                      onChange={(e) => setQDraft(e.target.value)}
                      placeholder="Search columns (name / description)…"
                      disabled={!selectedTable}
                    />
                  </div>

                  <div
                    className="text-muted small text-end"
                    style={{ minWidth: 110 }}
                  >
                    <span
                      style={{ visibility: statusText ? "visible" : "hidden" }}
                    >
                      {statusText || "…"}
                    </span>
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
                    <div className="alert alert-danger m-3 py-2">
                      {(modelQ.error as Error).message}
                    </div>
                  ) : null}

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0 dict-table">
                      <thead className="dict-thead">
                        {tableInst.getHeaderGroups().map((hg) => (
                          <tr key={hg.id}>
                            {hg.headers.map((h) => {
                              const cls =
                                (h.column.columnDef.meta as any)?.className ??
                                "";
                              return (
                                <th key={h.id} className={`px-3 py-2 ${cls}`}>
                                  {flexRender(
                                    h.column.columnDef.header,
                                    h.getContext(),
                                  )}
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
                            const key = toColumnLookupKey(
                              selectedTable?.name ?? "",
                              r.original.column_name,
                            );
                            const pulsing = pulsedColumnKey === key;

                            return (
                              <tr
                                key={r.id}
                                className={pulsing ? "dict-column-pulse" : ""}
                                ref={(node) => {
                                  if (node) rowRefMap.current.set(key, node);
                                  else rowRefMap.current.delete(key);
                                }}
                              >
                                {r.getVisibleCells().map((c) => {
                                  const cls =
                                    (c.column.columnDef.meta as any)
                                      ?.className ?? "";
                                  return (
                                    <td
                                      key={c.id}
                                      className={`px-3 py-2 ${cls}`}
                                    >
                                      {flexRender(
                                        c.column.columnDef.cell,
                                        c.getContext(),
                                      )}
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
                    <div className="text-muted small">
                      Rows: {rows.length.toLocaleString()}
                    </div>

                    <div className="d-flex gap-2 align-items-center">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => tableInst.previousPage()}
                        disabled={!tableInst.getCanPreviousPage()}
                      >
                        Prev
                      </button>

                      <div className="text-muted small">
                        Page {tableInst.getState().pagination.pageIndex + 1} of{" "}
                        {tableInst.getPageCount() || 1}
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
                        onChange={(e) =>
                          tableInst.setPageSize(Number(e.target.value))
                        }
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

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(result) => {
          setImportUnmatched(result.unmatched);
        }}
      />
      {preview ? (
        <ColumnPreviewDrawer
          open={!!preview}
          onClose={() => setPreview(null)}
          col={preview.col}
          isSelected={false}
          showSelectAction={false}
        />
      ) : null}
    </div>
  );
};
