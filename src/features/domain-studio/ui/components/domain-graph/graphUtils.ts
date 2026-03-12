import type {
  AvailableDomainTable,
  DomainGraphEdge,
  DomainGraphNode,
} from "./graphTypes";

let nodeSequence = 0;
let edgeSequence = 0;

export function createNodeId(): string {
  nodeSequence += 1;
  return `domain_node_${nodeSequence}`;
}

export function createEdgeId(): string {
  edgeSequence += 1;
  return `domain_edge_${edgeSequence}`;
}

export function defaultAliasFromTableName(rawTableName: string): string {
  const trimmed = rawTableName.trim();
  if (!trimmed) return "table";
  const base = trimmed.split(".").pop() ?? trimmed;
  return base.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "table";
}

export function buildEdgeLabel(sourceColumn: string, targetColumn: string): string {
  const left = sourceColumn.trim();
  const right = targetColumn.trim();
  if (!left && !right) return "Select join columns";
  if (!left || !right) return `${left || "?"} = ${right || "?"}`;
  return `${left} = ${right}`;
}

export function enforceOneRootNode(
  nodes: DomainGraphNode[],
  rootNodeId: string,
  markAsRoot: boolean
): DomainGraphNode[] {
  return nodes.map((node) => {
    if (node.id === rootNodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          isRoot: markAsRoot,
        },
      };
    }
    if (!markAsRoot) return node;
    return {
      ...node,
      data: {
        ...node.data,
        isRoot: false,
      },
    };
  });
}

export function removeConnectedEdges(
  edges: DomainGraphEdge[],
  nodeId: string
): DomainGraphEdge[] {
  return edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
}

export function removeNodeAndConnectedEdges(
  nodes: DomainGraphNode[],
  edges: DomainGraphEdge[],
  nodeId: string
): { nodes: DomainGraphNode[]; edges: DomainGraphEdge[] } {
  return {
    nodes: nodes.filter((node) => node.id !== nodeId),
    edges: removeConnectedEdges(edges, nodeId),
  };
}

export function hasDuplicateTableNode(
  nodes: DomainGraphNode[],
  table: AvailableDomainTable
): boolean {
  const normalizedName = table.tableName.trim().toLowerCase();
  return nodes.some((node) => {
    if (table.id !== null && node.data.tableId !== null) {
      return node.data.tableId === table.id;
    }
    return node.data.tableName.trim().toLowerCase() === normalizedName;
  });
}

export function hasDuplicateEdge(
  edges: DomainGraphEdge[],
  source: string,
  target: string
): boolean {
  return edges.some(
    (edge) =>
      (edge.source === source && edge.target === target) ||
      (edge.source === target && edge.target === source)
  );
}

export function getNextNodePosition(nodes: DomainGraphNode[]): { x: number; y: number } {
  const startX = 80;
  const startY = 80;
  const gapX = 300;
  const gapY = 180;
  const index = nodes.length;
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: startX + col * gapX,
    y: startY + row * gapY,
  };
}
