// src/features/domain-studio/ui/components/DictionaryTab.tsx
import React, {
  useCallback,
  useDeferredValue,
  useMemo,
  useTransition,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  fetchColumnSample,
  WorkspaceDictionaryColumn,
} from "../../../../shared/services/queryStudioAdminApi";
import type { DomainColumnRef } from "../../../query-forge/model/domainCatalog";
import { ColumnPreviewDrawer } from "../../../query-forge/ui/components/ColumnPreviewDrawer";
import { useDebounce } from "../../../../shared/runtime/useDeboune";
import { useDictionaryData } from "./useDictionaryData";
import { useDictionaryNavigation } from "./useDictionaryNavigation";
import { DictionaryTablePanel } from "./DictionaryTablePanel";
import {
  buildDictionaryColumns,
  DictionaryColumnGrid,
} from "./DictionaryColumnGrid";
import { toPreviewColumn } from "./dictionaryTabUtils";
import "../style/dictionaryTab.css";

const GLOBAL_SEARCH_DEBOUNCE_MS = 300;

type PreviewState = { col: DomainColumnRef } | null;

/** Upload modal — tightly coupled to orchestrator-level upload/import state */
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
      const { importDictionary } =
        await import("../../../../shared/services/queryStudioAdminApi");
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

export const DictionaryTab: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [tableFilter, setTableFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [globalSearchDraft, setGlobalSearchDraft] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [editing, setEditing] = useState<{
    id: number;
    field: "data_type" | "description";
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [importUnmatched, setImportUnmatched] = useState<
    Array<{ table_name: string; column_name: string }>
  >([]);
  const [preview, setPreview] = useState<PreviewState>(null);

  const [isSwitching, startTransition] = useTransition();
  const qDeferred = useDeferredValue(qDraft);
  const debouncedGlobalSearchTerm = useDebounce(
    globalSearchDraft.trim(),
    GLOBAL_SEARCH_DEBOUNCE_MS,
  );
  const isGlobalSearchMode = globalSearchDraft.trim().length > 0;

  const {
    allTableNames,
    filteredTableNames,
    rows,
    globalColumnHits: _hits,
    globalTableResults,
    globalColumnResults,
    patchM,
    tableNamesQ,
    modelQ,
    globalSearchQ,
  } = useDictionaryData({
    selectedTable,
    activeOnly,
    qDeferred,
    debouncedGlobalSearchTerm,
    tableFilter,
  });

  const showGlobalSearching =
    isGlobalSearchMode &&
    (debouncedGlobalSearchTerm !== globalSearchDraft.trim() ||
      globalSearchQ.isFetching);

  const statusText = patchM.isPending
    ? "Saving…"
    : isSwitching
      ? "Switching…"
      : selectedTable && modelQ.isFetching
        ? "Refreshing…"
        : "";

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
            col: {
              ...current.col,
              sampleError: "Failed to load sample data.",
            },
          };
        });
      });
  }, []);

  const columns = useMemo(
    () =>
      buildDictionaryColumns({
        editing,
        patchM,
        onSetEditing: setEditing,
        activeOnly,
        onActiveOnlyChange: setActiveOnly,
        onOpenPreview: openPreview,
      }),
    [patchM.isPending, editing, activeOnly, openPreview],
  );

  const tableInst = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const pagination = tableInst.getState().pagination;

  const { rowRefMap, tableButtonRefMap, setJumpToColumn, pulsedColumnKey } =
    useDictionaryNavigation({
      selectedTable,
      rows,
      isGlobalSearchMode,
      tableFilter,
      filteredTableNames,
      pagination,
      tableInst,
    });

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
          <DictionaryTablePanel
            allTableNames={allTableNames}
            filteredTableNames={filteredTableNames}
            tableFilter={tableFilter}
            onTableFilterChange={setTableFilter}
            selectedTable={selectedTable}
            onSelectTable={(t) => {
              setEditing(null);
              setJumpToColumn(null);
              setQDraft("");
              startTransition(() => setSelectedTable(t));
            }}
            tableButtonRefMap={tableButtonRefMap}
            tableNamesQ={tableNamesQ}
            globalSearchDraft={globalSearchDraft}
            onGlobalSearchChange={setGlobalSearchDraft}
            debouncedGlobalSearchTerm={debouncedGlobalSearchTerm}
            isGlobalSearchMode={isGlobalSearchMode}
            showGlobalSearching={showGlobalSearching}
            globalSearchQ={globalSearchQ}
            globalTableResults={globalTableResults}
            globalColumnResults={globalColumnResults}
            onJumpToColumn={setJumpToColumn}
            activeOnly={activeOnly}
            onActiveOnlyChange={setActiveOnly}
            onSetEditing={() => setEditing(null)}
            onClearQDraft={() => setQDraft("")}
            isSwitching={isSwitching}
            startTransition={startTransition}
          />
        </div>

        <div className="col-12 col-lg-9">
          <DictionaryColumnGrid
            selectedTable={selectedTable}
            rows={rows}
            tableInst={tableInst}
            columns={columns}
            modelQ={modelQ}
            patchM={patchM}
            editing={editing}
            onSetEditing={setEditing}
            activeOnly={activeOnly}
            onActiveOnlyChange={setActiveOnly}
            onOpenPreview={openPreview}
            rowRefMap={rowRefMap}
            pulsedColumnKey={pulsedColumnKey}
            qDraft={qDraft}
            onQDraftChange={setQDraft}
            statusText={statusText}
          />
        </div>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(result) => setImportUnmatched(result.unmatched)}
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
