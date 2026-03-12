import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  fetchRecon,
  fetchReconCounts,
  syncWorkspaceInventory,
  patchModelColumn,
  createModelColumn,
  ReconRow,
  fetchUnmappedTables,
  UnmappedTableRow,
} from "../../../../shared/services/queryStudioAdminApi";

function Pill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"} d-inline-flex align-items-center gap-2`}
    >
      <span>{label}</span>
      <span className={`badge ${active ? "text-bg-light" : "text-bg-secondary"}`}>
        {count ?? "—"}
      </span>
    </button>
  );
}

function statusBadgeClass(s: string) {
  // close to your prior soft colors, but bootstrap-native
  switch (s) {
    case "MISSING_IN_DICT":
      return "text-bg-warning";
    case "TYPE_MISMATCH":
      return "text-bg-danger";
    case "MISSING_IN_DBX":
      return "text-bg-secondary";
    case "NEEDS_REVIEW":
      return "text-bg-warning";
    case "MATCHED":
      return "text-bg-success";
    default:
      return "text-bg-light";
  }
}

function InlineReconTextArea(props: {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  resetKey: string;
  onSave: (next: string) => void;
}) {
  const [dirty, setDirty] = useState(false);

  return (
    <div className="d-flex gap-2 align-items-start">
      <textarea
        key={props.resetKey}
        defaultValue={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          const next = e.target.value ?? "";
          if (dirty && next !== props.value) props.onSave(next);
          setDirty(false);
        }}
        className="form-control form-control-sm"
        style={{
          minHeight: 54,
          maxHeight: 120,
          resize: "vertical",
        }}
      />
      {dirty ? <span className="text-muted small mt-1">●</span> : null}
    </div>
  );
}

export const ReconTab: React.FC = () => {
  const qc = useQueryClient();

  // status can be recon-status OR "UNMAPPED_TABLES"
  const [status, setStatus] = useState<string>("MISSING_IN_DICT");

  // filter text
  const [logical, setLogical] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 200;

  const [localDesc, setLocalDesc] = useState<Record<string, string>>({});

  const isUnmappedMode = status === "UNMAPPED_TABLES";

  const countsQ = useQuery({
    queryKey: ["reconCounts"],
    queryFn: fetchReconCounts,
    enabled: !isUnmappedMode,
  });

  const reconQ = useQuery({
    queryKey: ["recon", { status, logical, pageIndex }],
    enabled: !isUnmappedMode,
    queryFn: () =>
      fetchRecon({
        status: status || undefined,
        logical_table_name: logical || undefined,
        limit: pageSize,
        offset: pageIndex * pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const unmappedQ = useQuery({
    queryKey: ["unmappedTables", { q: logical, pageIndex }],
    enabled: isUnmappedMode,
    queryFn: () =>
      fetchUnmappedTables({
        schema: "asset",
        q: logical || undefined,
        limit: pageSize,
        offset: pageIndex * pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const syncM = useMutation({
    mutationFn: () => syncWorkspaceInventory("asset", undefined, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconCounts"] });
      qc.invalidateQueries({ queryKey: ["recon"] });
      qc.invalidateQueries({ queryKey: ["unmappedTables"] });
    },
  });

  const saveDescM = useMutation({
    mutationFn: async (args: { row: ReconRow; next: string }) => {
      const { row, next } = args;

      const cleaned = next.trim();
      const description = cleaned ? cleaned : null;

      // ✅ model (global) now owns dictionary columns
      if (row.dict_column_id) {
        await patchModelColumn(row.dict_column_id, { description });
        return { mode: "patched" as const, model_column_id: row.dict_column_id };
      }

      // ✅ create a model column
      // keep your existing behavior: create from recon row
      const created = await createModelColumn({
        tableName: row.logical_table_name,
        columnName: row.column_name,
        dataType: (row as any).dbx_data_type ?? null,
        description,
        isActive: true,
      });

      // createModelColumn in the corrected API returns { row: ... }
      const createdId = (created as any)?.row?.id ?? (created as any)?.id;
      return { mode: "created" as const, model_column_id: createdId };
    },
    onMutate: async ({ row, next }) => {
      const key = `${row.logical_table_name}::${row.column_name}`;
      setLocalDesc((prev) => ({ ...prev, [key]: next }));

      const qk = ["recon", { status, logical, pageIndex }] as const;
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData<{ rows: ReconRow[] }>(qk);

      if (prev?.rows) {
        qc.setQueryData(qk, {
          rows: prev.rows.map((r) => {
            if (
              r.logical_table_name === row.logical_table_name &&
              r.column_name === row.column_name
            ) {
              return { ...r, dict_description: next } as any;
            }
            return r;
          }),
        });
      }

      return { prev, qk };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.qk, ctx.prev);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconCounts"] });
      qc.invalidateQueries({ queryKey: ["recon"] });
      // if you have model admin screens:
      qc.invalidateQueries({ queryKey: ["modelColumns"] });
      qc.invalidateQueries({ queryKey: ["modelTables"] });
    },
  });

  const counts = countsQ.data?.counts ?? {};
  const reconRows = reconQ.data?.rows ?? [];

  const unmappedRows = unmappedQ.data?.rows ?? [];
  const unmappedTotal = unmappedQ.data?.total ?? 0;

  const columnsRecon = useMemo<ColumnDef<ReconRow>[]>(() => {
    return [
      {
        header: "Table",
        accessorKey: "logical_table_name",
        cell: ({ row }) => (
          <div className="text-truncate" style={{ maxWidth: 260 }} title={row.original.logical_table_name}>
            <div className="fw-semibold small">{row.original.logical_table_name}</div>
          </div>
        ),
      },
      {
        header: "Column",
        accessorKey: "column_name",
        cell: ({ row }) => (
          <div className="text-truncate" style={{ maxWidth: 240 }} title={row.original.column_name}>
            <div className="small">{row.original.column_name}</div>
          </div>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const s = row.original.status;
          return <span className={`badge ${statusBadgeClass(s)} fw-normal`}>{s}</span>;
        },
      },
      {
        header: "DBX Type",
        accessorKey: "dbx_data_type" as any,
        cell: ({ row }) => (row.original as any).dbx_data_type ?? "—",
      },
      {
        header: "Dict Type",
        accessorKey: "dict_data_type" as any,
        cell: ({ row }) => (row.original as any).dict_data_type ?? "—",
      },
      {
        header: "Description",
        accessorKey: "dict_description" as any,
        cell: ({ row }) => {
          const r = row.original as any;
          const cacheValue = (r.dict_description ?? "") as string;

          const key = `${r.logical_table_name}::${r.column_name}`;
          const effective = localDesc[key] ?? cacheValue;

          return (
            <div style={{ minWidth: 420 }}>
              <InlineReconTextArea
                value={effective}
                resetKey={`${r.logical_table_name}:${r.column_name}:${cacheValue}`}
                disabled={saveDescM.isPending}
                placeholder="Add a dictionary description…"
                onSave={(next) => saveDescM.mutate({ row: row.original, next })}
              />
              {r.dict_column_id ? (
                <div className="text-muted small mt-1">Model Column ID: {r.dict_column_id}</div>
              ) : (
                <div className="text-muted small mt-1">Not in model yet — saving will create it</div>
              )}
            </div>
          );
        },
      },
      {
        header: "DBX ID",
        accessorKey: "dbx_column_id",
        cell: ({ row }) => (row.original.dbx_column_id ?? "—") as any,
      },
    ];
  }, [localDesc, saveDescM.isPending]);

  const columnsUnmapped = useMemo<ColumnDef<UnmappedTableRow>[]>(() => {
    return [
      { header: "Schema", accessorKey: "schema_name" },
      { header: "Base table", accessorKey: "table_name" },
      { header: "Variant", accessorKey: "variant_code", cell: ({ row }) => row.original.variant_code ?? "—" },
      { header: "Full name", accessorKey: "full_name" },
      { header: "QE", accessorKey: "is_qe", cell: ({ row }) => (row.original.is_qe ? "Yes" : "No") },
      { header: "Last seen", accessorKey: "last_seen_at" },
    ];
  }, []);

  const activeRows = isUnmappedMode ? (unmappedRows as any[]) : (reconRows as any[]);
  const activeColumns = isUnmappedMode ? (columnsUnmapped as any) : (columnsRecon as any);

  const tableInst = useReactTable({
    data: activeRows,
    columns: activeColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: -1,
    state: { pagination: { pageIndex, pageSize } },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
  });

  const syncDisabled = syncM.isPending || saveDescM.isPending;

  const isFetching = isUnmappedMode ? unmappedQ.isFetching : reconQ.isFetching;
  const isLoading = isUnmappedMode ? unmappedQ.isLoading : reconQ.isLoading;
  const isError = isUnmappedMode ? unmappedQ.isError : reconQ.isError;
  const errorObj = isUnmappedMode ? unmappedQ.error : reconQ.error;

  const totalForPaging = isUnmappedMode ? unmappedTotal : undefined;
  const offset = pageIndex * pageSize;
  const canPrev = pageIndex > 0;
  const canNext = isUnmappedMode
    ? offset + pageSize < (totalForPaging ?? 0)
    : reconRows.length >= pageSize;

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between gap-3 align-items-center flex-wrap">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Pill
            label="Missing in Dict"
            count={counts["MISSING_IN_DICT"]}
            active={status === "MISSING_IN_DICT"}
            onClick={() => { setStatus("MISSING_IN_DICT"); setPageIndex(0); }}
          />
          <Pill
            label="Missing in DBX"
            count={counts["MISSING_IN_DBX"]}
            active={status === "MISSING_IN_DBX"}
            onClick={() => { setStatus("MISSING_IN_DBX"); setPageIndex(0); }}
          />
          <Pill
            label="Type mismatch"
            count={counts["TYPE_MISMATCH"]}
            active={status === "TYPE_MISMATCH"}
            onClick={() => { setStatus("TYPE_MISMATCH"); setPageIndex(0); }}
          />
          <Pill
            label="Needs review"
            count={counts["NEEDS_REVIEW"]}
            active={status === "NEEDS_REVIEW"}
            onClick={() => { setStatus("NEEDS_REVIEW"); setPageIndex(0); }}
          />
          <Pill
            label="Matched"
            count={counts["MATCHED"]}
            active={status === "MATCHED"}
            onClick={() => { setStatus("MATCHED"); setPageIndex(0); }}
          />
          <Pill
            label="Unmapped tables"
            count={isUnmappedMode ? unmappedTotal : undefined}
            active={status === "UNMAPPED_TABLES"}
            onClick={() => { setStatus("UNMAPPED_TABLES"); setPageIndex(0); }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => syncM.mutate()}
          disabled={syncDisabled}
        >
          {syncM.isPending ? "Syncing…" : "Sync & Reconcile"}
        </button>
      </div>

      <div className="d-flex gap-2 mt-3 flex-wrap align-items-center">
        <input
          className="form-control form-control-sm"
          style={{ width: 340 }}
          value={logical}
          onChange={(e) => { setLogical(e.target.value); setPageIndex(0); }}
          placeholder={isUnmappedMode ? "Search unmapped tables…" : "Filter by logical table name…"}
        />

        {isFetching ? <span className="text-muted small">Refreshing…</span> : null}
        {saveDescM.isPending && !isUnmappedMode ? <span className="text-muted small">Saving…</span> : null}
        {isUnmappedMode ? (
          <span className="text-muted small">
            Total: {(unmappedTotal ?? 0).toLocaleString()}
          </span>
        ) : null}
      </div>

      <hr className="my-3" />

      {isError ? (
        <div className="alert alert-danger py-2 mb-2">
          Error: {(errorObj as Error).message}
        </div>
      ) : null}

      {saveDescM.isError && !isUnmappedMode ? (
        <div className="alert alert-danger py-2 mb-2">
          Save error: {(saveDescM.error as Error).message}
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            {tableInst.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="small text-muted">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={(isUnmappedMode ? columnsUnmapped.length : columnsRecon.length)} className="py-3 text-muted">
                  Loading…
                </td>
              </tr>
            ) : activeRows.length === 0 ? (
              <tr>
                <td colSpan={(isUnmappedMode ? columnsUnmapped.length : columnsRecon.length)} className="py-3 text-muted">
                  No results.
                </td>
              </tr>
            ) : (
              tableInst.getRowModel().rows.map((r) => (
                <tr key={r.id} className={saveDescM.isPending && !isUnmappedMode ? "opacity-75" : ""}>
                  {r.getVisibleCells().map((c) => (
                    <td key={c.id} className="align-top">
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-center gap-3 pt-3 align-items-center">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
          disabled={!canPrev}
        >
          Prev
        </button>

        <div className="text-muted small">Offset {offset.toLocaleString()}</div>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setPageIndex(pageIndex + 1)}
          disabled={!canNext}
        >
          Next
        </button>
      </div>
    </div>
  );
};
