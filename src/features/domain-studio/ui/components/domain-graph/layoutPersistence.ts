import type { DomainGraphApiPayload } from "./graphTypes";

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "qf.domain-graph-layout.v1";

type StoredLayoutNode = {
  graph_node_id: string;
  x: number;
  y: number;
};

type StoredLayoutPayload = {
  version: number;
  nodes: StoredLayoutNode[];
};

export type DomainGraphLayoutPositions = Record<string, { x: number; y: number }>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getDomainGraphLayoutStorageKey(
  domainId: number,
  workspaceId: string | null
): string | null {
  const normalizedWorkspaceId = String(workspaceId ?? "").trim();
  if (!normalizedWorkspaceId) return null;
  if (!Number.isFinite(domainId) || domainId <= 0) return null;
  return `${STORAGE_PREFIX}:${normalizedWorkspaceId}:${Math.floor(domainId)}`;
}

export function loadDomainGraphLayout(
  domainId: number,
  workspaceId: string | null
): DomainGraphLayoutPositions {
  if (typeof window === "undefined" || !window.localStorage) return {};

  const key = getDomainGraphLayoutStorageKey(domainId, workspaceId);
  if (!key) return {};

  const raw = window.localStorage.getItem(key);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as StoredLayoutPayload | null;
    if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.nodes)) {
      return {};
    }

    return parsed.nodes.reduce<DomainGraphLayoutPositions>((acc, node) => {
      if (!node || typeof node.graph_node_id !== "string") return acc;
      if (!isFiniteNumber(node.x) || !isFiniteNumber(node.y)) return acc;
      acc[node.graph_node_id] = { x: node.x, y: node.y };
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function applyDomainGraphLayout(
  payload: DomainGraphApiPayload,
  positions: DomainGraphLayoutPositions
): DomainGraphApiPayload {
  return {
    ...payload,
    domain_tables: payload.domain_tables.map((table) => {
      const saved = positions[table.graph_node_id];
      if (!saved) return table;
      return {
        ...table,
        x: saved.x,
        y: saved.y,
      };
    }),
  };
}

export function persistDomainGraphLayout(
  domainId: number,
  workspaceId: string | null,
  payload: DomainGraphApiPayload
): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  const key = getDomainGraphLayoutStorageKey(domainId, workspaceId);
  if (!key) return;

  const nodes = payload.domain_tables
    .filter(
      (table): table is typeof table & { graph_node_id: string; x: number; y: number } =>
        typeof table.graph_node_id === "string" &&
        table.graph_node_id.length > 0 &&
        isFiniteNumber(table.x) &&
        isFiniteNumber(table.y)
    )
    .map((table) => ({
      graph_node_id: table.graph_node_id,
      x: table.x,
      y: table.y,
    }));

  const record: StoredLayoutPayload = {
    version: STORAGE_VERSION,
    nodes,
  };

  window.localStorage.setItem(key, JSON.stringify(record));
}

