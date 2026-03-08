import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { Modal } from "./Modal";
import type { WorkspaceTableRow, DomainJoinRow, DomainJoinSpec, WorkspaceColumnRow } from "../../../../shared/services/queryStudioAdminApi";
import {
  fetchDomainTables,
  setDomainPrimaryTable,
  addDomainTable,
  fetchDomainJoins,
  createDomainJoin,
  updateDomainJoin,
  deleteDomainJoin,
  fetchWorkspaceNamespaces,
  fetchWorkspaceTables,
  fetchWorkspaceTableColumns,
  syncWorkspaceInventory,
  updateDomainTables,
} from "../../../../shared/services/queryStudioAdminApi";
import { useAppSelector } from "../../../../shared/runtime/hooks";

type Props = {
  open: boolean;
  domainId: number | null;
  canEdit: boolean;
  onSaved?: () => void | Promise<void>;
};

type DragPayloadTable = { source: "available" | "assigned"; id: number };
const DRAG_MIME_TABLE = "application/x-domain-table";

type JoinConditionDraft = {
  id: string;
  leftMode: "column" | "json";
  rightMode: "column" | "json";
  leftColumn: string;
  rightColumn: string;
  leftJsonColumn: string;
  leftJsonKey: string;
  rightJsonColumn: string;
  rightJsonKey: string;
};

type JoinDraft = {
  mode: "create" | "edit";
  joinId?: string;
  toTableId: number;
  fromTableId: number | "";
  joinType: "LEFT" | "INNER" | "RIGHT";
  conditions: JoinConditionDraft[];
  extraPredicates: string;
  sortOrder: number;
};

export const DomainDrawerTablesTab: React.FC<Props> = ({ open, domainId, canEdit, onSaved }) => {
  const qc = useQueryClient();
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId ?? null);

  // Tables state
  const [q, setQ] = useState("");
  const [schemaName, setSchemaName] = useState("asset");

  // single-row highlight selection
  const [activeAvailableId, setActiveAvailableId] = useState<number | null>(null);
  const [activeAssignedId, setActiveAssignedId] = useState<number | null>(null);

  // assigned set is the true local “working state”
  const [assignedSet, setAssignedSet] = useState<Set<number>>(new Set());
  const assignedRowCacheRef = useRef<Map<number, WorkspaceTableRow>>(new Map());

  // drag over styling
  const [overLeft, setOverLeft] = useState(false);
  const [overRight, setOverRight] = useState(false);

  // join editor
  const [joinDraft, setJoinDraft] = useState<JoinDraft | null>(null);
  const joinCondSeq = useRef(0);

  // Reset on open/domain change
  useEffect(() => {
    if (!open) return;
    setQ("");
    setSchemaName("asset");
    setActiveAvailableId(null);
    setActiveAssignedId(null);
    setAssignedSet(new Set());
    assignedRowCacheRef.current = new Map();
    setOverLeft(false);
    setOverRight(false);
    setJoinDraft(null);
  }, [open, domainId]);

  // Queries only when needed
  const assignedQ = useQuery({
    queryKey: ["domainTables", { domainId }],
    enabled: open && !!domainId,
    queryFn: () => fetchDomainTables(domainId!),
  });

  const joinsQ = useQuery({
    queryKey: ["domainJoins", { domainId }],
    enabled: open && !!domainId,
    queryFn: () => fetchDomainJoins(domainId!),
  });

  const namespacesQ = useQuery({
    queryKey: ["workspaceNamespaces", { workspaceId }],
    enabled: open && !!workspaceId,
    queryFn: () => fetchWorkspaceNamespaces(workspaceId!),
    staleTime: 60_000,
  });

  const schemaOptions = useMemo(() => {
    const fromApi = (namespacesQ.data?.schemas ?? []) as string[];
    const ordered = fromApi.map((s: string) => (s || "").trim()).filter(Boolean);
    const seen = new Set<string>();
    const unique = ordered.filter((schema: string) => {
      const key = schema.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.length ? unique : ["asset", "workboard", "directory"];
  }, [namespacesQ.data?.schemas]);

  const allQ = useQuery({
    queryKey: ["workspaceTables", { workspaceId, q, schemaName }],
    enabled: open,
    queryFn: () =>
      fetchWorkspaceTables({
        workspaceId: workspaceId ?? undefined,
        q: q.trim() ? q.trim() : undefined,
        schema_name: schemaName || undefined,
        limit: 2000,
        offset: 0,
      }),
  });

  const syncInventoryM = useMutation({
    mutationFn: () => syncWorkspaceInventory(schemaName || "asset", undefined, true),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workspaceNamespaces"] });
      await qc.invalidateQueries({ queryKey: ["workspaceTables"] });
      toast.success("Workspace inventory refreshed.");
    },
  });

  const assignedRows: WorkspaceTableRow[] = (assignedQ.data?.rows ?? []) as any;
  const allRows: WorkspaceTableRow[] = (allQ.data?.rows ?? []) as any;

  // Initialize assignedSet when assignedRows load
  useEffect(() => {
    if (!open) return;
    if (!domainId) return;
    if (assignedQ.isLoading) return;

    const next = new Set<number>(assignedRows.map((r) => r.workspace_table_id));
    setAssignedSet(next);

    assignedRows.forEach((r) => assignedRowCacheRef.current.set(r.workspace_table_id, r));

    setActiveAvailableId(null);
    setActiveAssignedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, domainId, assignedQ.isLoading]);

  // For rendering details even after moving items:
  useEffect(() => {
    if (!assignedSet.size) return;
    allRows.forEach((r) => {
      if (assignedSet.has(r.workspace_table_id)) {
        assignedRowCacheRef.current.set(r.workspace_table_id, r);
      }
    });
  }, [allRows, assignedSet]);

  const rowById = useMemo(() => {
    const m = new Map<number, WorkspaceTableRow>(assignedRowCacheRef.current);
    [...assignedRows, ...allRows].forEach((r) => m.set(r.workspace_table_id, r));
    return m;
  }, [allRows, assignedRows, assignedSet]);

  const domainJoins: DomainJoinRow[] = (joinsQ.data?.rows ?? []) as any;

  const joinByToId = useMemo(() => {
    const m = new Map<number, DomainJoinRow>();
    domainJoins.forEach((j) => m.set(j.to_workspace_table_id, j));
    return m;
  }, [domainJoins]);

  const availableRows = useMemo(() => {
    return allRows.filter((r) => !assignedSet.has(r.workspace_table_id));
  }, [allRows, assignedSet]);

  const assignedDisplayRows = useMemo(() => {
    const ids = Array.from(assignedSet);
    const rows = ids.map((id) => rowById.get(id)).filter(Boolean) as WorkspaceTableRow[];
    const primary = rows.find((r) => r.is_primary);
    const rest = rows.filter((r) => !r.is_primary);
    rest.sort((a, b) => {
      const aOrder = a.sort_order ?? 0;
      const bOrder = b.sort_order ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.full_name.localeCompare(b.full_name);
    });
    return primary ? [primary, ...rest] : rest;
  }, [assignedSet, rowById]);

  const joinToRow = joinDraft ? rowById.get(joinDraft.toTableId) ?? null : null;
  const joinFromOptions = useMemo(() => {
    if (!joinDraft) return [];
    return assignedDisplayRows.filter((r) => r.workspace_table_id !== joinDraft.toTableId);
  }, [assignedDisplayRows, joinDraft]);

  const fromColumnsQ = useQuery({
    queryKey: ["workspaceTableColumns", { workspaceTableId: joinDraft?.fromTableId }],
    enabled: open && !!joinDraft && typeof joinDraft.fromTableId === "number",
    queryFn: () => fetchWorkspaceTableColumns(joinDraft!.fromTableId as number),
  });

  const toColumnsQ = useQuery({
    queryKey: ["workspaceTableColumns", { workspaceTableId: joinDraft?.toTableId }],
    enabled: open && !!joinDraft,
    queryFn: () => fetchWorkspaceTableColumns(joinDraft!.toTableId),
  });

  // diff tracking no longer needed; assignments auto-save

  const moveOneToAssigned = (id: number | null) => {
    if (!id) return;
    const row = allRows.find((r) => r.workspace_table_id === id);
    if (row) assignedRowCacheRef.current.set(id, row);
    addTableM.mutate(id);
    setActiveAvailableId(null);
    setActiveAssignedId(id);
  };

  const moveOneToAvailable = (id: number | null) => {
    if (!id) return;
    removeTableM.mutate(id);
    setActiveAssignedId(null);
    setActiveAvailableId(id);
  };

  const moveAllToAssigned = () => {
    const allAvailIds = availableRows.map((r) => r.workspace_table_id);
    availableRows.forEach((r) => assignedRowCacheRef.current.set(r.workspace_table_id, r));
    setAssignedSet((prev) => {
      const next = new Set(prev);
      allAvailIds.forEach((id) => next.add(id));
      return next;
    });
    if (allAvailIds.length > 0) {
      bulkUpdateM.mutate({ add: allAvailIds, remove: [] });
    }
    setActiveAvailableId(null);
  };

  const moveAllToAvailable = () => {
    const removeIds = assignedDisplayRows.map((r) => r.workspace_table_id);
    setAssignedSet(new Set());
    if (removeIds.length > 0) {
      bulkUpdateM.mutate({ add: [], remove: removeIds });
    }
    setActiveAssignedId(null);
  };

  const nextCondId = () => {
    joinCondSeq.current += 1;
    return `cond_${joinCondSeq.current}`;
  };

  const pickCommonColumn = (fromCols: WorkspaceColumnRow[], toCols: WorkspaceColumnRow[]) => {
    const fromNames = new Set(fromCols.map((c) => c.column_name.toLowerCase()));
    const toNames = new Set(toCols.map((c) => c.column_name.toLowerCase()));

    const prefer = "patient_id";
    if (fromNames.has(prefer) && toNames.has(prefer)) return prefer;

    for (const name of fromNames) {
      if (toNames.has(name)) return name;
    }
    return null;
  };

  const parseJoinExpr = (expr: string) => {
    const match = expr.match(/^get_json_object\(\{(from|to)\}\.([A-Za-z0-9_]+),\s*'\$\.([A-Za-z0-9_]+)'\)$/);
    if (!match) return null;
    return { scope: match[1], column: match[2], key: match[3] };
  };

  const makeEmptyCondition = (): JoinConditionDraft => ({
    id: nextCondId(),
    leftMode: "column",
    rightMode: "column",
    leftColumn: "",
    rightColumn: "",
    leftJsonColumn: "",
    leftJsonKey: "",
    rightJsonColumn: "",
    rightJsonKey: "",
  });

  useEffect(() => {
    if (!joinDraft) return;
    if (joinDraft.mode !== "create") return;
    if (joinDraft.conditions.length > 0) return;
    if (!fromColumnsQ.data?.rows || !toColumnsQ.data?.rows) return;

    const common = pickCommonColumn(fromColumnsQ.data.rows, toColumnsQ.data.rows);
    if (!common) return;

    setJoinDraft((prev) => {
      if (!prev) return prev;
      if (prev.conditions.length > 0) return prev;
      return {
        ...prev,
        conditions: [
          {
            id: nextCondId(),
            leftMode: "column",
            rightMode: "column",
            leftColumn: common,
            rightColumn: common,
            leftJsonColumn: "",
            leftJsonKey: "",
            rightJsonColumn: "",
            rightJsonKey: "",
          },
        ],
      };
    });
  }, [joinDraft, fromColumnsQ.data?.rows, toColumnsQ.data?.rows]);

  const openJoinEditor = (toTableId: number, existingJoin?: DomainJoinRow) => {
    const base: JoinDraft = {
      mode: existingJoin ? "edit" : "create",
      joinId: existingJoin?.id,
      toTableId,
      fromTableId: existingJoin?.from_workspace_table_id ?? "",
      joinType: existingJoin?.join_type ?? "LEFT",
      conditions: [],
      extraPredicates: existingJoin?.join_spec_json?.extra?.join("\n") ?? "",
      sortOrder: existingJoin?.sort_order ?? 0,
    };

    const on = existingJoin?.join_spec_json?.on ?? [];
    if (on.length > 0) {
      base.conditions = on.map((c) => {
        const leftExpr = c.left.expr ? parseJoinExpr(c.left.expr) : null;
        const rightExpr = c.right.expr ? parseJoinExpr(c.right.expr) : null;
        return {
          id: nextCondId(),
          leftMode: leftExpr ? "json" : "column",
          rightMode: rightExpr ? "json" : "column",
          leftColumn: c.left.columnName || c.left.col || "",
          rightColumn: c.right.columnName || c.right.col || "",
          leftJsonColumn: leftExpr?.column ?? "",
          leftJsonKey: leftExpr?.key ?? "",
          rightJsonColumn: rightExpr?.column ?? "",
          rightJsonKey: rightExpr?.key ?? "",
        };
      });
    }

    if (!existingJoin) {
      const primary = assignedDisplayRows.find((r) => r.is_primary);
      base.fromTableId = primary?.workspace_table_id ?? "";
    }

    setJoinDraft(base);
  };

  const closeJoinEditor = () => setJoinDraft(null);

  const formatJoinSide = (side: { columnName?: string; col?: string; expr?: string }) => {
    if (side.expr) {
      const parsed = parseJoinExpr(side.expr);
      if (parsed) {
        return `json(${parsed.column}.${parsed.key})`;
      }
      return side.expr;
    }
    return side.columnName || side.col || "";
  };

  const buildJoinSummary = (join: DomainJoinRow | undefined) => {
    if (!join) return "No join defined yet.";
    const fromRow = rowById.get(join.from_workspace_table_id);
    const fromLabel = fromRow
      ? `${fromRow.full_name} (${fromRow.catalog_name}.${fromRow.schema_name})`
      : `Table ${join.from_workspace_table_id}`;
    const conditions = join.join_spec_json?.on ?? [];
    if (conditions.length === 0) {
      return `Attach to ${fromLabel} ${join.join_type}`;
    }
    const first = conditions[0];
    const extraCount = conditions.length > 1 ? ` +${conditions.length - 1} more` : "";
    const leftLabel = formatJoinSide(first.left);
    const rightLabel = formatJoinSide(first.right);
    return `Attach to ${fromLabel} ${join.join_type} ON ${leftLabel} = ${rightLabel}${extraCount}`;
  };

  // Drag helpers (tables)
  const onDragStartTable = (source: DragPayloadTable["source"], id: number) => (e: React.DragEvent) => {
    const payload: DragPayloadTable = { source, id };
    e.dataTransfer.setData(DRAG_MIME_TABLE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const readDragTable = (e: React.DragEvent): DragPayloadTable | null => {
    const raw = e.dataTransfer.getData(DRAG_MIME_TABLE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayloadTable;
    } catch {
      return null;
    }
  };

  const allowDrop = (setter: (v: boolean) => void) => (e: React.DragEvent) => {
    e.preventDefault();
    setter(true);
  };

  const leaveDrop = (setter: (v: boolean) => void) => () => setter(false);

  const dropToAssigned = (e: React.DragEvent) => {
    e.preventDefault();
    setOverRight(false);
    const p = readDragTable(e);
    if (!p) return;
    if (p.source === "available") moveOneToAssigned(p.id);
  };

  const dropToAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    setOverLeft(false);
    const p = readDragTable(e);
    if (!p) return;
    if (p.source === "assigned") moveOneToAvailable(p.id);
  };

  const bulkUpdateM = useMutation({
    mutationFn: (payload: { add: number[]; remove: number[] }) =>
      updateDomainTables(domainId!, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domainTables"] });
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });

      setActiveAvailableId(null);
      setActiveAssignedId(null);

      toast.success("Tables updated.");
      await onSaved?.();
    },
  });

  const addTableM = useMutation({
    mutationFn: (workspaceTableId: number) =>
      addDomainTable(domainId!, { workspaceTableId, relationKind: "JOIN" }),
    onMutate: (workspaceTableId: number) => {
      setAssignedSet((prev) => new Set(prev).add(workspaceTableId));
    },
    onError: (_err, workspaceTableId) => {
      setAssignedSet((prev) => {
        const next = new Set(prev);
        next.delete(workspaceTableId);
        return next;
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domainTables"] });
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["domainJoins"] });
      toast.success("Table added.");
    },
  });

  const removeTableM = useMutation({
    mutationFn: (workspaceTableId: number) =>
      updateDomainTables(domainId!, { add: [], remove: [workspaceTableId] }),
    onMutate: (workspaceTableId: number) => {
      setAssignedSet((prev) => {
        const next = new Set(prev);
        next.delete(workspaceTableId);
        return next;
      });
    },
    onError: (_err, workspaceTableId) => {
      setAssignedSet((prev) => new Set(prev).add(workspaceTableId));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domainTables"] });
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["domainJoins"] });
      toast.success("Table removed.");
    },
  });

  const saveJoinM = useMutation({
    mutationFn: async (draft: JoinDraft) => {
      const joinSpec: DomainJoinSpec = {
        on: draft.conditions.map((c) => ({
          left:
            c.leftMode === "json"
              ? {
                  expr: `get_json_object({from}.${c.leftJsonColumn}, '$.${c.leftJsonKey}')`,
                }
              : { workspaceTableId: Number(draft.fromTableId), columnName: c.leftColumn },
          op: "=",
          right:
            c.rightMode === "json"
              ? {
                  expr: `get_json_object({to}.${c.rightJsonColumn}, '$.${c.rightJsonKey}')`,
                }
              : { workspaceTableId: draft.toTableId, columnName: c.rightColumn },
        })),
      };

      const extraLines = draft.extraPredicates
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (extraLines.length > 0) joinSpec.extra = extraLines;

      const payload = {
        fromWorkspaceTableId: Number(draft.fromTableId),
        toWorkspaceTableId: draft.toTableId,
        joinType: draft.joinType,
        joinSpec,
        sortOrder: draft.sortOrder,
      };

      if (draft.mode === "edit" && draft.joinId) {
        return updateDomainJoin(domainId!, draft.joinId, payload);
      }
      return createDomainJoin(domainId!, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domainJoins"] });
      setJoinDraft(null);
      toast.success("Join saved.");
    },
  });

  const deleteJoinM = useMutation({
    mutationFn: (joinId: string) => deleteDomainJoin(domainId!, joinId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domainJoins"] });
      toast.success("Join removed.");
    },
  });

  const setPrimaryM = useMutation({
    mutationFn: (workspaceTableId: number) => setDomainPrimaryTable(domainId!, workspaceTableId),
    onMutate: (workspaceTableId: number) => {
      setActiveAssignedId(workspaceTableId);
      const prevTables = qc.getQueryData<{ rows: WorkspaceTableRow[] }>(["domainTables", { domainId }]);
      const prevJoins = qc.getQueryData<{ rows: DomainJoinRow[] }>(["domainJoins", { domainId }]);

      if (prevTables?.rows) {
        const nextRows = prevTables.rows.map((r) => ({
          ...r,
          is_primary: r.workspace_table_id === workspaceTableId,
        }));
        qc.setQueryData(["domainTables", { domainId }], { rows: nextRows });
      }

      if (prevJoins?.rows) {
        const nextJoins = prevJoins.rows.filter((j) => j.to_workspace_table_id !== workspaceTableId);
        qc.setQueryData(["domainJoins", { domainId }], { rows: nextJoins });
      }

      return { prevTables, prevJoins };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevTables) {
        qc.setQueryData(["domainTables", { domainId }], ctx.prevTables);
      }
      if (ctx?.prevJoins) {
        qc.setQueryData(["domainJoins", { domainId }], ctx.prevJoins);
      }
    },
    onSuccess: async (data) => {
      if (data?.rows) {
        qc.setQueryData(["domainTables", { domainId }], data);
      }
      await qc.invalidateQueries({ queryKey: ["domainTables"] });
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["domainJoins"] });
      toast.success("Primary table set.");
    },
  });

  const updateTableMetaM = useMutation({
    mutationFn: (payload: {
      workspaceTableId: number;
      filterMode?: "AUTO" | "WHERE" | "EXISTS";
      cardinality?: "ONE" | "MANY";
      tableAlias?: string | null;
    }) => addDomainTable(domainId!, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["domainTables", { domainId }] });
      const prevTables = qc.getQueryData(["domainTables", { domainId }]);

      if (prevTables && (prevTables as any).rows) {
        const nextRows = (prevTables as any).rows.map((r: any) => {
          if (r.workspace_table_id !== payload.workspaceTableId) return r;
          return {
            ...r,
            ...(payload.filterMode ? { filter_mode: payload.filterMode } : {}),
            ...(payload.cardinality ? { cardinality: payload.cardinality } : {}),
            ...(payload.tableAlias !== undefined ? { table_alias: payload.tableAlias } : {}),
          };
        });
        qc.setQueryData(["domainTables", { domainId }], { ...(prevTables as any), rows: nextRows });
      }

      return { prevTables };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevTables) {
        qc.setQueryData(["domainTables", { domainId }], ctx.prevTables);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domainTables"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      toast.success("Table updated.");
    },
  });

  return (
    <>
      <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
        <div className="text-muted small ms-auto">
          {assignedDisplayRows.length.toLocaleString()} assigned • {availableRows.length.toLocaleString()} available
        </div>
      </div>

      {(allQ.isError || assignedQ.isError || joinsQ.isError || bulkUpdateM.isError || addTableM.isError || removeTableM.isError || saveJoinM.isError || deleteJoinM.isError || setPrimaryM.isError || updateTableMetaM.isError) ? (
        <div className="alert alert-danger py-2">
          {((allQ.error || assignedQ.error || joinsQ.error || bulkUpdateM.error || addTableM.error || removeTableM.error || saveJoinM.error || deleteJoinM.error || setPrimaryM.error || updateTableMetaM.error) as Error)?.message}
        </div>
      ) : null}

      <div className="domains-dual">
        {/* LEFT: Available */}
        <div
          className={`card domains-dual__panel domains-dual__dropzone ${overLeft ? "is-over" : ""}`}
          onDragOver={allowDrop(setOverLeft)}
          onDragEnter={allowDrop(setOverLeft)}
          onDragLeave={leaveDrop(setOverLeft)}
          onDrop={dropToAvailable}
        >
          <div className="card-header py-2 d-flex justify-content-between align-items-center">
            <div className="fw-semibold">Available Tables</div>
            <div className="text-muted small">drag →</div>
          </div>

          <div className="border-bottom px-2 py-2 d-flex align-items-center gap-2">
            <div className="input-group input-group-sm flex-grow-1">
              <span className="input-group-text bg-white">Schema</span>
              <select
                className="form-select"
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
              >
                {schemaOptions.map((schema) => (
                  <option key={schema} value={schema}>
                    {schema}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => syncInventoryM.mutate()}
              disabled={!workspaceId || syncInventoryM.isPending}
              title="Refresh workspace tables"
            >
              <i className={`fa ${syncInventoryM.isPending ? "fa-spinner fa-spin" : "fa-rotate"}`} />
            </button>
          </div>

          <div className="border-bottom px-2 py-2">
            <div className="input-group input-group-sm" style={{ width: "100%" }}>
              <span className="input-group-text bg-white">
                <i className="fa fa-search text-muted" />
              </span>
              <input
                className="form-control"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search workspace tables…"
              />
            </div>
          </div>

          <div className="card-body p-0 domains-dual__list">
            {allQ.isLoading ? (
              <div className="p-3 text-muted small">Loading…</div>
            ) : availableRows.length === 0 ? (
              <div className="p-3 text-muted small">No available tables.</div>
            ) : (
              availableRows
                .slice()
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map((r) => {
                  const active = activeAvailableId === r.workspace_table_id;
                  return (
                    <div
                      key={r.workspace_table_id}
                      className={`domains-dual__row ${active ? "active" : ""}`}
                      draggable={canEdit}
                      onDragStart={onDragStartTable("available", r.workspace_table_id)}
                      onClick={() => {
                        setActiveAvailableId(r.workspace_table_id);
                        setActiveAssignedId(null);
                      }}
                      onDoubleClick={() => canEdit && moveOneToAssigned(r.workspace_table_id)}
                      title={canEdit ? "Double-click to assign, or drag to the right." : ""}
                    >
                      <div style={{ flex: 1 }}>
                        <div className="domains-dual__row-title">{r.full_name}</div>
                        <div className="domains-dual__row-sub text-muted">
                          {r.catalog_name}.{r.schema_name}
                          {" • "}
                          model: {r.model_table_name}
                          {r.variant_code ? ` • variant: ${r.variant_code}` : ""}
                          {r.is_qe ? " • QE" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* MIDDLE: Controls */}
        <div className="domains-dual__controls">
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={!canEdit || !activeAvailableId}
            onClick={() => moveOneToAssigned(activeAvailableId)}
            title="Assign selected"
          >
            <i className="fa fa-chevron-right" />
          </button>

          <button
            className="btn btn-outline-primary btn-sm"
            disabled={!canEdit || availableRows.length === 0}
            onClick={moveAllToAssigned}
            title="Assign all"
          >
            <i className="fa fa-angle-double-right" />
          </button>

          <div style={{ height: 10 }} />

          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!canEdit || !activeAssignedId}
            onClick={() => moveOneToAvailable(activeAssignedId)}
            title="Unassign selected"
          >
            <i className="fa fa-chevron-left" />
          </button>

          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!canEdit || assignedDisplayRows.length === 0}
            onClick={moveAllToAvailable}
            title="Unassign all"
          >
            <i className="fa fa-angle-double-left" />
          </button>
        </div>

        {/* RIGHT: Assigned */}
        <div
          className={`card domains-dual__panel domains-dual__dropzone ${overRight ? "is-over" : ""}`}
          onDragOver={allowDrop(setOverRight)}
          onDragEnter={allowDrop(setOverRight)}
          onDragLeave={leaveDrop(setOverRight)}
          onDrop={dropToAssigned}
        >
          <div className="card-header py-2 d-flex justify-content-between align-items-center">
            <div className="fw-semibold">Assigned to Domain</div>
            <div className="text-muted small">← drag</div>
          </div>

          <div className="card-body p-0 domains-dual__list">
            {assignedQ.isLoading ? (
              <div className="p-3 text-muted small">Loading…</div>
            ) : assignedDisplayRows.length === 0 ? (
              <div className="p-3 text-muted small">No tables assigned yet.</div>
            ) : (
              assignedDisplayRows
                .slice()
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map((r) => {
                  const active = activeAssignedId === r.workspace_table_id;
                  const relationKind = (r.relation_kind || "JOIN").toUpperCase();
                  const isPrimary = r.is_primary === true;
                  const filterMode = (r.filter_mode || "AUTO").toUpperCase() as
                    | "AUTO"
                    | "WHERE"
                    | "EXISTS";
                  const cardinality = (r.cardinality || "ONE").toUpperCase() as "ONE" | "MANY";
                  const tableAlias = (r.table_alias ?? "").trim();
                  const join = joinByToId.get(r.workspace_table_id);
                  const showJoin = !isPrimary && relationKind === "JOIN";
                  const filterModeValue = isPrimary ? "WHERE" : filterMode;
                  return (
                    <div
                      key={r.workspace_table_id}
                      className={`domains-dual__row domains-dual__row--stack ${active ? "active" : ""}`}
                      draggable={canEdit}
                      onDragStart={onDragStartTable("assigned", r.workspace_table_id)}
                      onClick={() => {
                        setActiveAssignedId(r.workspace_table_id);
                        setActiveAvailableId(null);
                      }}
                      onDoubleClick={() => canEdit && moveOneToAvailable(r.workspace_table_id)}
                      title={canEdit ? "Double-click to unassign, or drag to the left." : ""}
                    >
                      <div className="domains-dual__row-main">
                        <div style={{ flex: 1 }}>
                          <div className="domains-dual__row-title d-flex align-items-center gap-2">
                            <span>{r.full_name}</span>
                            {isPrimary ? <span className="badge text-bg-primary">Primary</span> : null}
                          </div>
                          <div className="domains-dual__row-sub text-muted">
                            {r.catalog_name}.{r.schema_name}
                            {" • "}
                            model: {r.model_table_name}
                            {r.variant_code ? ` • variant: ${r.variant_code}` : ""}
                            {r.is_qe ? " • QE" : ""}
                          </div>
                        </div>
                        {!isPrimary ? (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrimaryM.mutate(r.workspace_table_id);
                            }}
                            disabled={!canEdit || setPrimaryM.isPending}
                            title="Set as primary table"
                            aria-label="Set as primary table"
                          >
                            <i className="fa fa-star" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>

                      {showJoin ? (
                        <div className="domains-join">
                          <div style={{ flex: 1 }}>
                            <div className="text-uppercase text-muted small fw-semibold mb-1">Join</div>
                            <div className="domains-join__summary text-muted">
                              {buildJoinSummary(join)}
                            </div>
                          </div>
                          <div className="d-flex gap-2">
                            {join ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openJoinEditor(r.workspace_table_id, join);
                                  }}
                                  title="Edit join"
                                  aria-label="Edit join"
                                >
                                  <i className="fa fa-pencil" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteJoinM.mutate(join.id);
                                  }}
                                  title="Remove join"
                                  aria-label="Remove join"
                                >
                                  <i className="fa fa-xmark" aria-hidden="true" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openJoinEditor(r.workspace_table_id);
                                }}
                              >
                                Add join
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="d-flex gap-3 align-items-center mt-2 flex-wrap">
                        <div className="d-flex flex-column" style={{ minWidth: 180 }}>
                          <label className="form-label small text-muted mb-1">Table alias</label>
                          <input
                            key={`${r.workspace_table_id}:${tableAlias}`}
                            className="form-control form-control-sm"
                            defaultValue={tableAlias}
                            placeholder="e.g. dx"
                            disabled={!canEdit || updateTableMetaM.isPending}
                            onBlur={(e) => {
                              const next = e.currentTarget.value.trim();
                              const nextValue = next.length ? next : null;
                              if ((r.table_alias ?? "") === (nextValue ?? "")) return;
                              updateTableMetaM.mutate({
                                workspaceTableId: r.workspace_table_id,
                                tableAlias: nextValue,
                              });
                            }}
                          />
                        </div>
                        <div className="d-flex flex-column">
                          <label className="form-label small text-muted mb-1">Filter mode</label>
                          <select
                            className="form-select form-select-sm"
                            value={filterModeValue}
                            disabled={!canEdit || isPrimary || updateTableMetaM.isPending}
                            onChange={(e) => {
                              const next = e.target.value as "AUTO" | "WHERE" | "EXISTS";
                              updateTableMetaM.mutate({
                                workspaceTableId: r.workspace_table_id,
                                filterMode: next,
                              });
                            }}
                          >
                            <option value="AUTO">AUTO</option>
                            <option value="WHERE">WHERE</option>
                            <option value="EXISTS">EXISTS</option>
                          </select>
                          {isPrimary ? (
                            <div className="small text-muted mt-1">Primary tables always filter in WHERE.</div>
                          ) : null}
                        </div>

                        <div className="d-flex flex-column">
                          <label className="form-label small text-muted mb-1">Cardinality</label>
                          <select
                            className="form-select form-select-sm"
                            value={cardinality}
                            disabled={!canEdit || updateTableMetaM.isPending}
                            onChange={(e) => {
                              const next = e.target.value as "ONE" | "MANY";
                              const nextFilterMode =
                                next === "MANY" && filterModeValue === "AUTO" ? "EXISTS" : undefined;
                              updateTableMetaM.mutate({
                                workspaceTableId: r.workspace_table_id,
                                cardinality: next,
                                ...(nextFilterMode ? { filterMode: nextFilterMode } : {}),
                              });
                            }}
                          >
                            <option value="ONE">ONE</option>
                            <option value="MANY">MANY</option>
                          </select>
                          {!isPrimary && cardinality === "MANY" && filterModeValue === "AUTO" ? (
                            <div className="small text-muted mt-1">Suggested: EXISTS for MANY tables.</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      <div className="text-muted small mt-3">
        Tables auto-save as you add or remove them.
      </div>

      <div className="text-muted small mt-2">
        Tip: click to highlight, use chevrons, or drag & drop between lists. Double-click moves one item.
      </div>

      <Modal
        open={!!joinDraft}
        title={joinDraft?.mode === "edit" ? "Edit Join" : "Add Join"}
        width={920}
        onClose={closeJoinEditor}
        footer={
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div className="text-muted small">
              Joins create a simple tree: each table gets one incoming join.
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={closeJoinEditor}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={
                  !joinDraft ||
                  !canEdit ||
                  saveJoinM.isPending ||
                  typeof joinDraft.fromTableId !== "number" ||
                  joinDraft.conditions.length === 0 ||
                  joinDraft.conditions.some((c) =>
                    c.leftMode === "json"
                      ? !c.leftJsonColumn || !c.leftJsonKey
                      : !c.leftColumn
                  ) ||
                  joinDraft.conditions.some((c) =>
                    c.rightMode === "json"
                      ? !c.rightJsonColumn || !c.rightJsonKey
                      : !c.rightColumn
                  )
                }
                onClick={() => joinDraft && saveJoinM.mutate(joinDraft)}
              >
                {saveJoinM.isPending ? "Saving…" : "Save Join"}
              </button>
            </div>
          </div>
        }
      >
        {joinDraft && joinToRow ? (
          <div className="vstack gap-3">
            <div className="border rounded p-3 bg-light">
              <div className="text-muted small">To table (current)</div>
              <div className="fw-semibold text-primary">{joinToRow.full_name}</div>
              <div className="text-muted small">
                {joinToRow.catalog_name}.{joinToRow.schema_name}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="fw-semibold mb-2">Join setup</div>
                <div className="row g-3 align-items-end">
                  <div className="col-12 col-md-7">
                    <label className="form-label small text-muted">From table</label>
                    <select
                      className="form-select form-select-sm"
                      value={joinDraft.fromTableId === "" ? "" : String(joinDraft.fromTableId)}
                      onChange={(e) =>
                        setJoinDraft({
                          ...joinDraft,
                          fromTableId: e.target.value ? Number(e.target.value) : "",
                          conditions: [],
                        })
                      }
                    >
                      <option value="">Select table…</option>
                      {joinFromOptions.map((t) => (
                        <option key={t.workspace_table_id} value={t.workspace_table_id}>
                          {t.full_name} ({t.catalog_name}.{t.schema_name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label small text-muted">Join type</label>
                    <select
                      className="form-select form-select-sm"
                      value={joinDraft.joinType}
                      onChange={(e) =>
                        setJoinDraft({ ...joinDraft, joinType: e.target.value as JoinDraft["joinType"] })
                      }
                    >
                      <option value="LEFT">LEFT</option>
                      <option value="INNER">INNER</option>
                      <option value="RIGHT">RIGHT</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small text-muted">Sort</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={joinDraft.sortOrder}
                      onChange={(e) => setJoinDraft({ ...joinDraft, sortOrder: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">Join conditions</div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() =>
                      setJoinDraft({
                        ...joinDraft,
                        conditions: [
                          ...joinDraft.conditions,
                          makeEmptyCondition(),
                        ],
                      })
                    }
                    disabled={typeof joinDraft.fromTableId !== "number"}
                  >
                    Add condition
                  </button>
                </div>
                <div className="text-muted small mb-2">
                  Tip: use JSON field when the join key lives inside a JSON column.
                  <span
                    className="ms-2 text-decoration-underline"
                    title="JSON field builds get_json_object({from|to}.json_column, '$.key') in the join."
                  >
                    What is this?
                  </span>
                </div>

                {typeof joinDraft.fromTableId !== "number" ? (
                  <div className="text-muted small">Select a from table to configure join columns.</div>
                ) : (
                  <div className="vstack gap-2">
                    {joinDraft.conditions.map((cond, idx) => (
                      <div key={cond.id} className="row g-2 align-items-center">
                        <div className="col-12 col-md-5">
                          <div className="d-flex gap-2 align-items-center">
                            <select
                              className="form-select form-select-sm"
                              style={{ maxWidth: 130 }}
                              value={cond.leftMode}
                              onChange={(e) => {
                                const next = [...joinDraft.conditions];
                                next[idx] = { ...cond, leftMode: e.target.value as "column" | "json" };
                                setJoinDraft({ ...joinDraft, conditions: next });
                              }}
                            >
                              <option value="column">Column</option>
                              <option value="json">JSON field</option>
                            </select>
                            {cond.leftMode === "json" ? (
                              <>
                                <select className="form-select form-select-sm" style={{ maxWidth: 170 }} value="get_json_object" disabled>
                                  <option value="get_json_object">get_json_object</option>
                                </select>
                                <select
                                  className="form-select form-select-sm"
                                  value={cond.leftJsonColumn}
                                  onChange={(e) => {
                                    const next = [...joinDraft.conditions];
                                    next[idx] = { ...cond, leftJsonColumn: e.target.value };
                                    setJoinDraft({ ...joinDraft, conditions: next });
                                  }}
                                >
                                  <option value="">JSON column…</option>
                                  {(fromColumnsQ.data?.rows ?? []).map((c) => (
                                    <option key={c.column_name} value={c.column_name}>
                                      {c.column_name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="form-control form-control-sm"
                                  placeholder="JSON key"
                                  value={cond.leftJsonKey}
                                  onChange={(e) => {
                                    const next = [...joinDraft.conditions];
                                    next[idx] = { ...cond, leftJsonKey: e.target.value };
                                    setJoinDraft({ ...joinDraft, conditions: next });
                                  }}
                                />
                              </>
                            ) : (
                              <select
                                className="form-select form-select-sm"
                                value={cond.leftColumn}
                                onChange={(e) => {
                                  const next = [...joinDraft.conditions];
                                  next[idx] = { ...cond, leftColumn: e.target.value };
                                  setJoinDraft({ ...joinDraft, conditions: next });
                                }}
                              >
                                <option value="">Left column…</option>
                                {(fromColumnsQ.data?.rows ?? []).map((c) => (
                                  <option key={c.column_name} value={c.column_name}>
                                    {c.column_name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                        <div className="col-12 col-md-1 text-center text-muted small">=</div>
                        <div className="col-12 col-md-5">
                          <div className="d-flex gap-2 align-items-center">
                            <select
                              className="form-select form-select-sm"
                              style={{ maxWidth: 130 }}
                              value={cond.rightMode}
                              onChange={(e) => {
                                const next = [...joinDraft.conditions];
                                next[idx] = { ...cond, rightMode: e.target.value as "column" | "json" };
                                setJoinDraft({ ...joinDraft, conditions: next });
                              }}
                            >
                              <option value="column">Column</option>
                              <option value="json">JSON field</option>
                            </select>
                            {cond.rightMode === "json" ? (
                              <>
                                <select className="form-select form-select-sm" style={{ maxWidth: 170 }} value="get_json_object" disabled>
                                  <option value="get_json_object">get_json_object</option>
                                </select>
                                <select
                                  className="form-select form-select-sm"
                                  value={cond.rightJsonColumn}
                                  onChange={(e) => {
                                    const next = [...joinDraft.conditions];
                                    next[idx] = { ...cond, rightJsonColumn: e.target.value };
                                    setJoinDraft({ ...joinDraft, conditions: next });
                                  }}
                                >
                                  <option value="">JSON column…</option>
                                  {(toColumnsQ.data?.rows ?? []).map((c) => (
                                    <option key={c.column_name} value={c.column_name}>
                                      {c.column_name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="form-control form-control-sm"
                                  placeholder="JSON key"
                                  value={cond.rightJsonKey}
                                  onChange={(e) => {
                                    const next = [...joinDraft.conditions];
                                    next[idx] = { ...cond, rightJsonKey: e.target.value };
                                    setJoinDraft({ ...joinDraft, conditions: next });
                                  }}
                                />
                              </>
                            ) : (
                              <select
                                className="form-select form-select-sm"
                                value={cond.rightColumn}
                                onChange={(e) => {
                                  const next = [...joinDraft.conditions];
                                  next[idx] = { ...cond, rightColumn: e.target.value };
                                  setJoinDraft({ ...joinDraft, conditions: next });
                                }}
                              >
                                <option value="">Right column…</option>
                                {(toColumnsQ.data?.rows ?? []).map((c) => (
                                  <option key={c.column_name} value={c.column_name}>
                                    {c.column_name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                        <div className="col-12 col-md-3 text-end">
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() =>
                              setJoinDraft({
                                ...joinDraft,
                                conditions: joinDraft.conditions.filter((c) => c.id !== cond.id),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <label className="form-label small text-muted">Extra predicates (optional)</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  value={joinDraft.extraPredicates}
                  onChange={(e) => setJoinDraft({ ...joinDraft, extraPredicates: e.target.value })}
                  placeholder="One predicate per line"
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default DomainDrawerTablesTab;
