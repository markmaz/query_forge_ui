import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppSelector } from "@/shared/runtime/hooks";
import { getApiWorkspaceId } from "@/shared/services/api";
import {
  fetchWorkspaceNamespaces,
  fetchWorkspaceTables,
  type WorkspaceTableRow,
} from "@/shared/services/queryStudioAdminApi";

import AvailableTablesSidebar from "./AvailableTablesSidebar";
import DomainInspector from "./DomainInspector";
import DomainJoinEdge from "./DomainJoinEdge";
import DomainTableNode from "./DomainTableNode";
import {
  apiPayloadToGraph,
  dtoToGraph,
  graphToApiPayload,
  graphToDto,
} from "./graphMappers";
import {
  buildEdgeLabel,
  createEdgeId,
  createNodeId,
  defaultAliasFromTableName,
  enforceOneRootNode,
  getNextNodePosition,
  hasDuplicateEdge,
  hasDuplicateTableNode,
  removeNodeAndConnectedEdges,
} from "./graphUtils";
import {
  DOMAIN_TABLE_DND_MIME,
  MOCK_JOINABLE_COLUMNS,
  type AvailableDomainTable,
  type DomainGraphApiPayload,
  type DomainGraphDto,
  type DomainGraphEdge,
  type DomainGraphNode,
  type InspectorSelection,
} from "./graphTypes";

const nodeTypes: NodeTypes = {
  domainTable: DomainTableNode,
};

const edgeTypes: EdgeTypes = {
  domainJoin: DomainJoinEdge,
};

type DomainGraphBuilderProps = {
  initialDto?: DomainGraphDto;
  initialApiPayload?: DomainGraphApiPayload;
  onGraphChange?: (dto: DomainGraphDto, payload: DomainGraphApiPayload) => void;
  height?: number | string;
  joinableColumns?: readonly string[];
};

type GraphBuilderInnerProps = DomainGraphBuilderProps;

function GraphBuilderInner({
  initialDto,
  initialApiPayload,
  onGraphChange,
  height = 880,
  joinableColumns = MOCK_JOINABLE_COLUMNS,
}: GraphBuilderInnerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow<DomainGraphNode, DomainGraphEdge>();
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
  const [schemaFilter, setSchemaFilter] = useState<string>("ALL");
  const [tableSearch, setTableSearch] = useState("");
  const initialGraph = useMemo(() => {
    if (initialDto) return dtoToGraph(initialDto);
    if (initialApiPayload) return apiPayloadToGraph(initialApiPayload);
    return { nodes: [] as DomainGraphNode[], edges: [] as DomainGraphEdge[] };
  }, [initialApiPayload, initialDto]);

  const [nodes, setNodes, onNodesChange] = useNodesState<DomainGraphNode>(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DomainGraphEdge>(initialGraph.edges);
  const [selection, setSelection] = useState<InspectorSelection>(null);

  const namespacesQ = useQuery({
    queryKey: ["workspaceNamespaces", { workspaceId }],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceNamespaces(workspaceId!),
    staleTime: 60_000,
  });

  const schemaOptions = useMemo(() => {
    const schemas = namespacesQ.data?.schemas ?? [];
    return ["ALL", ...schemas];
  }, [namespacesQ.data?.schemas]);

  useEffect(() => {
    if (schemaOptions.length === 0) return;
    if (!schemaOptions.includes(schemaFilter)) {
      setSchemaFilter(schemaOptions[0]);
    }
  }, [schemaFilter, schemaOptions]);

  const workspaceTablesQ = useQuery({
    queryKey: [
      "workspaceTables",
      {
        workspaceId,
        schemaFilter,
        q: tableSearch.trim().toLowerCase(),
      },
    ],
    enabled: !!workspaceId,
    queryFn: () =>
      fetchWorkspaceTables({
        workspaceId: workspaceId ?? undefined,
        schema_name: schemaFilter !== "ALL" ? schemaFilter : undefined,
        q: tableSearch.trim() ? tableSearch.trim() : undefined,
        limit: 3000,
        offset: 0,
      }),
  });

  const availableTables = useMemo<AvailableDomainTable[]>(() => {
    const rows = (workspaceTablesQ.data?.rows ?? []) as WorkspaceTableRow[];
    return rows
      .filter((row) => Number.isFinite(Number(row.workspace_table_id)))
      .map((row) => {
        const catalog = row.catalog_name || "";
        const schema = row.schema_name || "";
        const table = row.table_name || row.full_name || `workspace_table_${row.workspace_table_id}`;
        const fullName =
          row.full_name ||
          [catalog, schema, table]
            .filter(Boolean)
            .join(".");
        return {
          id: Number(row.workspace_table_id),
          fullName,
          catalogName: catalog || undefined,
          schemaName: schema,
          tableName: table,
        };
      });
  }, [workspaceTablesQ.data?.rows]);

  useEffect(() => {
    const dto = graphToDto(nodes, edges);
    const payload = graphToApiPayload(nodes, edges);
    onGraphChange?.(dto, payload);
  }, [edges, nodes, onGraphChange]);

  useEffect(() => {
    if (!selection) return;
    if (selection.type === "node") {
      if (!nodes.some((node) => node.id === selection.id)) setSelection(null);
      return;
    }
    if (!edges.some((edge) => edge.id === selection.id)) setSelection(null);
  }, [edges, nodes, selection]);

  const addTableToCanvas = useCallback(
    (table: AvailableDomainTable, explicitPosition?: { x: number; y: number }) => {
      const duplicateNode = nodes.find((node) => {
        if (table.id !== null && node.data.tableId !== null) {
          return node.data.tableId === table.id;
        }
        return node.data.tableName.toLowerCase() === table.tableName.toLowerCase();
      });

      if (duplicateNode) {
        setSelection({ type: "node", id: duplicateNode.id });
        return;
      }

      if (hasDuplicateTableNode(nodes, table)) return;

      const nodeId = createNodeId();
      let position = explicitPosition;
      if (!position) {
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (bounds) {
          const center = screenToFlowPosition({
            x: bounds.left + bounds.width * 0.5,
            y: bounds.top + bounds.height * 0.35,
          });
          const offsetIndex = nodes.length % 6;
          position = {
            x: center.x + (offsetIndex % 3) * 24,
            y: center.y + Math.floor(offsetIndex / 3) * 24,
          };
        } else {
          position = getNextNodePosition(nodes);
        }
      }

      const newNode: DomainGraphNode = {
        id: nodeId,
        type: "domainTable",
        position,
        data: {
          tableId: table.id,
          tableName: table.tableName,
          schemaName: table.schemaName,
          alias: defaultAliasFromTableName(table.tableName),
          filterMode: "AUTO",
          cardinality: "ONE",
          isRoot: false,
        },
      };

      setNodes((prev) => [...prev, newNode]);
      setSelection({ type: "node", id: nodeId });
    },
    [nodes, screenToFlowPosition, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      if (hasDuplicateEdge(edges, connection.source, connection.target)) return;

      const edgeId = createEdgeId();
      const newEdge: DomainGraphEdge = {
        id: edgeId,
        type: "domainJoin",
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        data: {
          joinType: "LEFT",
          sourceColumn: "",
          targetColumn: "",
          label: buildEdgeLabel("", ""),
        },
      };

      setEdges((prev) => [...prev, newEdge]);
      setSelection({ type: "edge", id: edgeId });
    },
    [edges, setEdges]
  );

  const onDragOverCanvas = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDropToCanvas = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(DOMAIN_TABLE_DND_MIME);
      if (!raw) return;

      let table: AvailableDomainTable | null = null;
      try {
        table = JSON.parse(raw) as AvailableDomainTable;
      } catch {
        table = null;
      }
      if (!table) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addTableToCanvas(table, position);
    },
    [addTableToCanvas, screenToFlowPosition]
  );

  const onUpdateNode = useCallback(
    (nodeId: string, patch: Partial<DomainGraphNode["data"]>) => {
      setNodes((prevNodes) => {
        let next = prevNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node
        );

        if (Object.prototype.hasOwnProperty.call(patch, "isRoot")) {
          next = enforceOneRootNode(next, nodeId, Boolean(patch.isRoot));
        }
        return next;
      });
    },
    [setNodes]
  );

  const onUpdateEdge = useCallback(
    (
      edgeId: string,
      patch: Partial<NonNullable<DomainGraphEdge["data"]>>
    ) => {
      setEdges((prevEdges) =>
        prevEdges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const nextData = {
            joinType: edge.data?.joinType ?? "LEFT",
            sourceColumn: edge.data?.sourceColumn ?? "",
            targetColumn: edge.data?.targetColumn ?? "",
            label: edge.data?.label ?? buildEdgeLabel("", ""),
            ...patch,
          };
          nextData.label = buildEdgeLabel(nextData.sourceColumn, nextData.targetColumn);
          return {
            ...edge,
            data: nextData,
          };
        })
      );
    },
    [setEdges]
  );

  const onDeleteSelected = useCallback(() => {
    if (!selection) return;

    if (selection.type === "node") {
      setNodes((prevNodes) => {
        const result = removeNodeAndConnectedEdges(prevNodes, edges, selection.id);
        setEdges(result.edges);
        return result.nodes;
      });
    }

    if (selection.type === "edge") {
      setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== selection.id));
    }

    setSelection(null);
  }, [edges, selection, setEdges, setNodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
      if (!isDeleteKey) return;
      if (!selection) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        const isFormField =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          Boolean(target.isContentEditable);
        if (isFormField) return;
      }

      event.preventDefault();
      onDeleteSelected();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onDeleteSelected, selection]);

  const onNodesDelete = useCallback(
    (deletedNodes: DomainGraphNode[]) => {
      if (!deletedNodes.length) return;
      const deletedIds = new Set(deletedNodes.map((node) => node.id));
      setEdges((prevEdges) =>
        prevEdges.filter(
          (edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)
        )
      );
      if (
        selection &&
        selection.type === "node" &&
        deletedIds.has(selection.id)
      ) {
        setSelection(null);
      }
    },
    [selection, setEdges]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: DomainGraphEdge[]) => {
      if (
        selection &&
        selection.type === "edge" &&
        deletedEdges.some((edge) => edge.id === selection.id)
      ) {
        setSelection(null);
      }
    },
    [selection]
  );

  const selectedNode = useMemo(
    () => (selection?.type === "node" ? nodes.find((node) => node.id === selection.id) ?? null : null),
    [nodes, selection]
  );
  const selectedEdge = useMemo(
    () => (selection?.type === "edge" ? edges.find((edge) => edge.id === selection.id) ?? null : null),
    [edges, selection]
  );
  const selectedEdgeSourceNode = useMemo(
    () =>
      selectedEdge
        ? nodes.find((node) => node.id === selectedEdge.source) ?? null
        : null,
    [nodes, selectedEdge]
  );
  const selectedEdgeTargetNode = useMemo(
    () =>
      selectedEdge
        ? nodes.find((node) => node.id === selectedEdge.target) ?? null
        : null,
    [nodes, selectedEdge]
  );

  const resolvedHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 320px",
        gap: 12,
        width: "100%",
      }}
    >
      <AvailableTablesSidebar
        tables={availableTables}
        schemaOptions={schemaOptions}
        selectedSchema={schemaFilter}
        onSchemaChange={setSchemaFilter}
        searchValue={tableSearch}
        onSearchChange={setTableSearch}
        workspaceId={workspaceId}
        isLoading={namespacesQ.isLoading || workspaceTablesQ.isLoading}
        isError={!workspaceId || namespacesQ.isError || workspaceTablesQ.isError}
        errorMessage={
          ((namespacesQ.error as Error | null)?.message ??
            (workspaceTablesQ.error as Error | null)?.message ??
            (!workspaceId ? "No workspace selected." : null)) ??
          undefined
        }
        onAddTable={addTableToCanvas}
      />

      <div
        style={{
          border: "1px solid #dbe2ea",
          borderRadius: 12,
          background: "#ffffff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Domain Graph</div>
          <button
            className="btn btn-sm btn-outline-primary"
            style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={() => fitView({ padding: 0.2, duration: 350 })}
          >
            Fit View
          </button>
        </div>

        <div
          ref={wrapperRef}
          style={{ width: "100%", height: resolvedHeight, minHeight: 520 }}
          onDrop={onDropToCanvas}
          onDragOver={onDragOverCanvas}
        >
          <ReactFlow<DomainGraphNode, DomainGraphEdge>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelection({ type: "node", id: node.id })}
            onEdgeClick={(_, edge) => setSelection({ type: "edge", id: edge.id })}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onPaneClick={() => setSelection(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.35}
            maxZoom={1.8}
            defaultEdgeOptions={{ type: "domainJoin" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.2}
              color="#d2d9e2"
            />
            <Controls position="bottom-right" />
          </ReactFlow>
        </div>
      </div>

      <DomainInspector
        selection={selection}
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        selectedEdgeSourceNode={selectedEdgeSourceNode}
        selectedEdgeTargetNode={selectedEdgeTargetNode}
        workspaceId={workspaceId}
        joinableColumns={joinableColumns}
        onUpdateNode={onUpdateNode}
        onUpdateEdge={onUpdateEdge}
        onDeleteSelected={onDeleteSelected}
      />
    </div>
  );
}

export default function DomainGraphBuilder(props: DomainGraphBuilderProps) {
  return (
    <ReactFlowProvider>
      <GraphBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
