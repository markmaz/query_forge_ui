export interface RebuildAllRequest {
  force?: boolean;
}

export interface RebuildAllResponse {
  status: "completed" | "completed_with_errors";
  results: {
    semantic_concepts?: { conceptPoints: number; aliasPoints: number };
    embeddings?: { tablesIndexed: number; columnsIndexed: number };
    domain_vectors?: { upserted: number; skipped: number; total: number };
  };
  errors: Record<string, string>;
  workspace_id: string;
}

export interface SemanticConceptRebuildRequest {}

export interface SemanticConceptRebuildResponse {
  result: { conceptPoints: number; aliasPoints: number };
}

export interface EmbeddingsRebuildRequest {
  include_tables?: boolean;
  limit?: number;
}

export interface EmbeddingsRebuildResponse {
  result: { tablesIndexed: number; columnsIndexed: number };
}

export interface DomainVectorReindexRequest {
  force?: boolean;
}

export interface DomainVectorReindexResponse {
  result: {
    upserted: number;
    skipped: number;
    total: number;
    timings_ms?: Record<string, number>;
    collection?: Record<string, unknown>;
  };
}

export type IndexStatus = "idle" | "building" | "completed" | "error";

export interface IndexCardState {
  status: IndexStatus;
  result?: Record<string, unknown>;
  error?: string;
}
