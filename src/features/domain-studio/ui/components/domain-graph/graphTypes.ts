import type { Edge, Node } from "@xyflow/react";

export const DOMAIN_TABLE_DND_MIME = "application/x-queryforge-domain-table";

export type DomainFilterMode = "AUTO" | "REQUIRED" | "OPTIONAL";
export type DomainCardinality = "ONE" | "MANY";
export type DomainJoinType = "INNER" | "LEFT";

export type DomainGraphNodeData = {
  tableId: number | null;
  tableName: string;
  schemaName?: string;
  alias: string;
  filterMode: DomainFilterMode;
  cardinality: DomainCardinality;
  isRoot?: boolean;
};

export type DomainGraphEdgeData = {
  joinType: DomainJoinType;
  sourceColumn: string;
  targetColumn: string;
  label: string;
};

export type DomainGraphNode = Node<DomainGraphNodeData, "domainTable">;
export type DomainGraphEdge = Edge<DomainGraphEdgeData, "domainJoin">;

export type InspectorSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

export type DomainGraphDto = {
  nodes: Array<{
    id: string;
    tableId: number | null;
    tableName: string;
    schemaName?: string;
    alias: string;
    filterMode: DomainFilterMode;
    cardinality: DomainCardinality;
    isRoot?: boolean;
    x: number;
    y: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    joinType: DomainJoinType;
    sourceColumn: string;
    targetColumn: string;
    label: string;
  }>;
};

export type DomainGraphApiPayload = {
  domain_tables: Array<{
    graph_node_id: string;
    workspace_table_id: number | null;
    table_name: string;
    schema_name?: string;
    table_alias: string;
    filter_mode: DomainFilterMode;
    cardinality: DomainCardinality;
    is_root?: boolean;
    x: number;
    y: number;
  }>;
  joins: Array<{
    graph_edge_id: string;
    from_graph_node_id: string;
    to_graph_node_id: string;
    join_type: DomainJoinType;
    source_column: string;
    target_column: string;
    label: string;
  }>;
};

export type AvailableDomainTable = {
  id: number | null;
  fullName: string;
  catalogName?: string;
  schemaName: string;
  tableName: string;
};

export const MOCK_JOINABLE_COLUMNS = [
  "k_student",
  "k_school",
  "k_lea",
  "school_year",
  "session_name",
] as const;
