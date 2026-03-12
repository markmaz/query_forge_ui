import type {
  DomainGraphApiPayload,
  DomainGraphDto,
  DomainGraphEdge,
  DomainGraphNode,
} from "./graphTypes";
import { buildEdgeLabel } from "./graphUtils";

export function graphToDto(
  nodes: DomainGraphNode[],
  edges: DomainGraphEdge[]
): DomainGraphDto {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      tableId: node.data.tableId,
      tableName: node.data.tableName,
      schemaName: node.data.schemaName,
      alias: node.data.alias,
      filterMode: node.data.filterMode,
      cardinality: node.data.cardinality,
      isRoot: Boolean(node.data.isRoot),
      x: node.position.x,
      y: node.position.y,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      joinType: edge.data?.joinType ?? "LEFT",
      sourceColumn: edge.data?.sourceColumn ?? "",
      targetColumn: edge.data?.targetColumn ?? "",
      label: edge.data?.label ?? buildEdgeLabel("", ""),
    })),
  };
}

export function dtoToGraph(
  dto: DomainGraphDto
): { nodes: DomainGraphNode[]; edges: DomainGraphEdge[] } {
  return {
    nodes: (dto.nodes ?? []).map((node) => ({
      id: node.id,
      type: "domainTable",
      position: { x: node.x, y: node.y },
      data: {
        tableId: node.tableId,
        tableName: node.tableName,
        schemaName: node.schemaName,
        alias: node.alias,
        filterMode: node.filterMode,
        cardinality: node.cardinality,
        isRoot: Boolean(node.isRoot),
      },
    })),
    edges: (dto.edges ?? []).map((edge) => ({
      id: edge.id,
      type: "domainJoin",
      source: edge.source,
      target: edge.target,
      data: {
        joinType: edge.joinType,
        sourceColumn: edge.sourceColumn,
        targetColumn: edge.targetColumn,
        label:
          edge.label ||
          buildEdgeLabel(edge.sourceColumn, edge.targetColumn),
      },
    })),
  };
}

export function graphToApiPayload(
  nodes: DomainGraphNode[],
  edges: DomainGraphEdge[]
): DomainGraphApiPayload {
  return {
    domain_tables: nodes.map((node) => ({
      graph_node_id: node.id,
      workspace_table_id: node.data.tableId,
      table_name: node.data.tableName,
      schema_name: node.data.schemaName,
      table_alias: node.data.alias,
      filter_mode: node.data.filterMode,
      cardinality: node.data.cardinality,
      is_root: Boolean(node.data.isRoot),
      x: node.position.x,
      y: node.position.y,
    })),
    joins: edges.map((edge) => ({
      graph_edge_id: edge.id,
      from_graph_node_id: edge.source,
      to_graph_node_id: edge.target,
      join_type: edge.data?.joinType ?? "LEFT",
      source_column: edge.data?.sourceColumn ?? "",
      target_column: edge.data?.targetColumn ?? "",
      label: edge.data?.label ?? buildEdgeLabel("", ""),
    })),
  };
}

export function apiPayloadToGraph(
  payload: DomainGraphApiPayload
): { nodes: DomainGraphNode[]; edges: DomainGraphEdge[] } {
  return {
    nodes: (payload.domain_tables ?? []).map((table) => ({
      id: table.graph_node_id,
      type: "domainTable",
      position: {
        x: table.x ?? 0,
        y: table.y ?? 0,
      },
      data: {
        tableId: table.workspace_table_id,
        tableName: table.table_name,
        schemaName: table.schema_name,
        alias: table.table_alias,
        filterMode: table.filter_mode,
        cardinality: table.cardinality,
        isRoot: Boolean(table.is_root),
      },
    })),
    edges: (payload.joins ?? []).map((join) => ({
      id: join.graph_edge_id,
      type: "domainJoin",
      source: join.from_graph_node_id,
      target: join.to_graph_node_id,
      data: {
        joinType: join.join_type,
        sourceColumn: join.source_column,
        targetColumn: join.target_column,
        label:
          join.label ||
          buildEdgeLabel(join.source_column, join.target_column),
      },
    })),
  };
}
