import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import DomainGraphBuilder from "./components/domain-graph/DomainGraphBuilder";
import type { DomainGraphApiPayload } from "./components/domain-graph/graphTypes";
import { buildEdgeLabel } from "./components/domain-graph/graphUtils";
import {
  addDomainTable,
  createDomainJoin,
  deleteDomainJoin,
  fetchDomainJoins,
  fetchDomainTables,
  fetchDomains,
  setDomainPrimaryTable,
  updateDomainJoin,
  updateDomainTables,
  type DomainJoinRow,
  type DomainJoinSpec,
  type WorkspaceTableRow,
} from "../../../shared/services/queryStudioAdminApi";
import { getApiWorkspaceId } from "../../../shared/services/api";
import { useAppSelector } from "../../../shared/runtime/hooks";
import { routes } from "../../../app/navigation/routes";

type GraphFilterMode = "AUTO" | "REQUIRED" | "OPTIONAL";

function toGraphFilterMode(value: WorkspaceTableRow["filter_mode"]): GraphFilterMode {
  if (value === "WHERE") return "REQUIRED";
  if (value === "EXISTS") return "OPTIONAL";
  return "AUTO";
}

function toDomainFilterMode(value: string | null | undefined): "AUTO" | "WHERE" | "EXISTS" {
  if (value === "REQUIRED") return "WHERE";
  if (value === "OPTIONAL") return "EXISTS";
  return "AUTO";
}

function extractColumnForSide(
  join: DomainJoinRow,
  side: "left" | "right"
): { source: string; target: string } {
  const conditions = Array.isArray(join.join_spec_json?.on) ? join.join_spec_json.on : [];
  const first = conditions[0];
  if (!first) return { source: "", target: "" };

  const left = first.left ?? {};
  const right = first.right ?? {};
  const leftColumn = left.columnName ?? left.col ?? "";
  const rightColumn = right.columnName ?? right.col ?? "";

  const leftTableId = Number(left.workspaceTableId ?? 0);
  const rightTableId = Number(right.workspaceTableId ?? 0);

  if (side === "left") {
    if (leftTableId === join.from_workspace_table_id) {
      return { source: String(leftColumn), target: String(rightColumn) };
    }
    if (rightTableId === join.from_workspace_table_id) {
      return { source: String(rightColumn), target: String(leftColumn) };
    }
  } else {
    if (leftTableId === join.to_workspace_table_id) {
      return { source: String(rightColumn), target: String(leftColumn) };
    }
    if (rightTableId === join.to_workspace_table_id) {
      return { source: String(leftColumn), target: String(rightColumn) };
    }
  }

  return { source: String(leftColumn), target: String(rightColumn) };
}

function domainDataToGraphPayload(
  tables: WorkspaceTableRow[],
  joins: DomainJoinRow[]
): DomainGraphApiPayload {
  const graphNodeIdByTableId = new Map<number, string>();

  const domainTables = tables.map((table, index) => {
    const graphNodeId = `domain_table_${table.workspace_table_id}`;
    graphNodeIdByTableId.set(table.workspace_table_id, graphNodeId);

    return {
      graph_node_id: graphNodeId,
      workspace_table_id: table.workspace_table_id,
      table_name: table.table_name,
      schema_name: table.schema_name,
      table_alias: table.table_alias ?? table.table_name,
      filter_mode: toGraphFilterMode(table.filter_mode),
      cardinality: table.cardinality ?? "ONE",
      is_root: Boolean(table.is_primary),
      x: 80 + (index % 4) * 220,
      y: 80 + Math.floor(index / 4) * 180,
    };
  });

  const graphJoins = joins
    .map((join) => {
      const sourceNodeId = graphNodeIdByTableId.get(join.from_workspace_table_id);
      const targetNodeId = graphNodeIdByTableId.get(join.to_workspace_table_id);
      if (!sourceNodeId || !targetNodeId) return null;

      const columns = extractColumnForSide(join, "left");
      return {
        graph_edge_id: join.id,
        from_graph_node_id: sourceNodeId,
        to_graph_node_id: targetNodeId,
        join_type: join.join_type === "INNER" ? "INNER" : "LEFT",
        source_column: columns.source,
        target_column: columns.target,
        label: buildEdgeLabel(columns.source, columns.target),
      };
    })
    .filter((join): join is NonNullable<typeof join> => Boolean(join));

  return {
    domain_tables: domainTables,
    joins: graphJoins,
  };
}

export default function DomainGraphEditorPage() {
  const params = useParams<{ domainId: string }>();
  const domainId = Number(params.domainId);
  const qc = useQueryClient();

  const workspaceIdFromState = useAppSelector((state) => {
    const selected = state.userWorkspaces.selectedWorkspaceId;
    if (selected) return String(selected);
    const defaultWorkspace = state.userWorkspaces.defaultWorkspace as
      | { workspace_id?: string | null; workspaceId?: string | null }
      | undefined;
    const defaultId = defaultWorkspace?.workspace_id ?? defaultWorkspace?.workspaceId;
    if (defaultId) return String(defaultId);
    const firstWorkspace = (state.userWorkspaces.workspaces as
      | Array<{ workspace_id?: string | null; workspaceId?: string | null }>
      | undefined)?.[0];
    const firstId = firstWorkspace?.workspace_id ?? firstWorkspace?.workspaceId;
    return firstId ? String(firstId) : null;
  });
  const workspaceId = workspaceIdFromState ?? getApiWorkspaceId() ?? null;

  const [editorKey, setEditorKey] = useState(0);
  const [graphPayload, setGraphPayload] = useState<DomainGraphApiPayload | null>(null);
  const [loadedPayload, setLoadedPayload] = useState<DomainGraphApiPayload | null>(null);

  const handleGraphChange = useCallback((_: unknown, payload: DomainGraphApiPayload) => {
    setGraphPayload((prev) => {
      if (!prev) return payload;
      const prevText = JSON.stringify(prev);
      const nextText = JSON.stringify(payload);
      return prevText === nextText ? prev : payload;
    });
  }, []);

  const domainsQ = useQuery({
    queryKey: ["domains"],
    queryFn: fetchDomains,
  });

  const domainTablesQ = useQuery({
    queryKey: ["domainTables", { domainId, workspaceId }],
    enabled: Number.isFinite(domainId) && domainId > 0 && !!workspaceId,
    queryFn: () => fetchDomainTables(domainId, workspaceId),
    refetchOnWindowFocus: false,
    staleTime: 120_000,
  });

  const domainJoinsQ = useQuery({
    queryKey: ["domainJoins", { domainId, workspaceId }],
    enabled: Number.isFinite(domainId) && domainId > 0 && !!workspaceId,
    queryFn: () => fetchDomainJoins(domainId, workspaceId),
    refetchOnWindowFocus: false,
    staleTime: 120_000,
  });

  const domain = useMemo(
    () => (domainsQ.data?.rows ?? []).find((row) => row.id === domainId) ?? null,
    [domainId, domainsQ.data?.rows]
  );

  const initialPayload = useMemo(() => {
    const tables = (domainTablesQ.data?.rows ?? []) as WorkspaceTableRow[];
    const joins = (domainJoinsQ.data?.rows ?? []) as DomainJoinRow[];
    return domainDataToGraphPayload(tables, joins);
  }, [domainJoinsQ.data?.rows, domainTablesQ.data?.rows]);

  useEffect(() => {
    if (!domainTablesQ.data || !domainJoinsQ.data) return;
    setLoadedPayload(initialPayload);
    setGraphPayload(initialPayload);
    setEditorKey((prev) => prev + 1);
  }, [domainId, domainJoinsQ.data, domainTablesQ.data, initialPayload]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!graphPayload) throw new Error("Graph is not ready yet.");
      if (!workspaceId) throw new Error("No workspace selected.");
      if (!Number.isFinite(domainId) || domainId <= 0) throw new Error("Invalid domain id.");

      const existingTables = ((domainTablesQ.data?.rows ?? []) as WorkspaceTableRow[])
        .map((row) => row.workspace_table_id);
      const existingTableSet = new Set(existingTables);

      const nextDomainTables = graphPayload.domain_tables.filter(
        (table): table is typeof table & { workspace_table_id: number } =>
          typeof table.workspace_table_id === "number" && table.workspace_table_id > 0
      );
      if (nextDomainTables.length === 0) {
        throw new Error("Add at least one table before saving.");
      }

      const nextTableIds = nextDomainTables.map((table) => table.workspace_table_id);
      const nextTableSet = new Set(nextTableIds);

      const add = nextTableIds.filter((id) => !existingTableSet.has(id));
      const remove = existingTables.filter((id) => !nextTableSet.has(id));

      if (add.length > 0 || remove.length > 0) {
        await updateDomainTables(domainId, { add, remove }, workspaceId);
      }

      for (const table of nextDomainTables) {
        await addDomainTable(
          domainId,
          {
            workspaceTableId: table.workspace_table_id,
            relationKind: "JOIN",
            tableAlias: table.table_alias ?? null,
            filterMode: toDomainFilterMode(table.filter_mode),
            cardinality: table.cardinality === "MANY" ? "MANY" : "ONE",
          },
          workspaceId
        );
      }

      const rootTable =
        nextDomainTables.find((table) => table.is_root && typeof table.workspace_table_id === "number") ??
        nextDomainTables[0];
      if (rootTable?.workspace_table_id) {
        await setDomainPrimaryTable(domainId, rootTable.workspace_table_id, workspaceId);
      }

      const nodeByGraphId = new Map(
        nextDomainTables.map((table) => [table.graph_node_id, table] as const)
      );

      const existingJoins = (domainJoinsQ.data?.rows ?? []) as DomainJoinRow[];
      const existingJoinById = new Map(existingJoins.map((join) => [join.id, join] as const));
      const nextJoinIds = new Set(graphPayload.joins.map((join) => join.graph_edge_id));

      for (const existing of existingJoins) {
        if (!nextJoinIds.has(existing.id)) {
          await deleteDomainJoin(domainId, existing.id, workspaceId);
        }
      }

      const nextPayload: DomainGraphApiPayload = {
        domain_tables: [...graphPayload.domain_tables],
        joins: graphPayload.joins.map((join) => ({ ...join })),
      };

      for (let i = 0; i < nextPayload.joins.length; i += 1) {
        const join = nextPayload.joins[i];
        const sourceNode = nodeByGraphId.get(join.from_graph_node_id);
        const targetNode = nodeByGraphId.get(join.to_graph_node_id);
        if (!sourceNode?.workspace_table_id || !targetNode?.workspace_table_id) {
          throw new Error("Join references a missing table node.");
        }
        if (!join.source_column || !join.target_column) {
          throw new Error("Each join must include source and target columns.");
        }

        const joinSpec: DomainJoinSpec = {
          on: [
            {
              left: {
                workspaceTableId: sourceNode.workspace_table_id,
                columnName: join.source_column,
              },
              op: "=",
              right: {
                workspaceTableId: targetNode.workspace_table_id,
                columnName: join.target_column,
              },
            },
          ],
          extra: [],
        };

        const payload = {
          fromWorkspaceTableId: sourceNode.workspace_table_id,
          toWorkspaceTableId: targetNode.workspace_table_id,
          joinType: join.join_type === "INNER" ? "INNER" : "LEFT",
          joinSpec,
          sortOrder: i + 1,
        } as const;

        if (existingJoinById.has(join.graph_edge_id)) {
          await updateDomainJoin(domainId, join.graph_edge_id, payload, workspaceId);
        } else {
          const created = await createDomainJoin(domainId, payload, workspaceId);
          if (created?.id) {
            join.graph_edge_id = created.id;
          }
        }
      }

      setGraphPayload(nextPayload);
      return nextPayload;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["domainTables", { domainId, workspaceId }] });
      await qc.invalidateQueries({ queryKey: ["domainJoins", { domainId, workspaceId }] });
      toast.success("Domain graph saved.");
    },
    onError: (error) => {
      toast.error((error as Error).message || "Unable to save domain graph.");
    },
  });

  const loading = domainTablesQ.isLoading || domainJoinsQ.isLoading;
  const hasError = domainTablesQ.isError || domainJoinsQ.isError;
  const errorMessage =
    ((domainTablesQ.error as Error | null)?.message ??
      (domainJoinsQ.error as Error | null)?.message) || null;

  return (
    <div style={{ padding: 20 }}>
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <Link to={routes.NoCodeAdminDomains} className="btn btn-sm btn-outline-secondary mb-2">
            <i className="fa fa-arrow-left me-2" />
            Back to Domains
          </Link>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>Domain Graph Editor</div>
          <div className="text-muted small">
            {domain ? `${domain.name} (#${domain.id})` : `Domain #${domainId}`}
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={!loadedPayload || saveM.isPending}
            onClick={() => {
              if (!loadedPayload) return;
              setGraphPayload(loadedPayload);
              setEditorKey((prev) => prev + 1);
            }}
          >
            Reset
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={!graphPayload || saveM.isPending}
            onClick={() => saveM.mutate()}
          >
            {saveM.isPending ? "Saving…" : "Save Graph"}
          </button>
        </div>
      </div>

      {hasError ? <div className="alert alert-danger py-2">{errorMessage}</div> : null}
      {!workspaceId ? (
        <div className="alert alert-warning py-2">No workspace selected.</div>
      ) : null}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", padding: 10 }}>
        {loading || !graphPayload ? (
          <div className="text-muted small p-3">Loading domain graph…</div>
        ) : (
          <DomainGraphBuilder
            key={`domain-graph-editor-${domainId}-${editorKey}`}
            initialApiPayload={graphPayload}
            onGraphChange={handleGraphChange}
            height={1080}
          />
        )}
      </div>
    </div>
  );
}
