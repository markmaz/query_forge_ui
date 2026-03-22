export interface RebuildAllRequest {
  vertical_norm?: string;
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
  vertical_norm: string;
}

export interface SemanticConceptRebuildRequest {
  vertical_norm: string;
}

export interface SemanticConceptRebuildResponse {
  result: { conceptPoints: number; aliasPoints: number };
  vertical_norm: string;
}

export interface EmbeddingsRebuildRequest {
  include_tables?: boolean;
  limit?: number;
}

export interface EmbeddingsRebuildResponse {
  result: { tablesIndexed: number; columnsIndexed: number };
}

export interface DomainVectorReindexRequest {
  vertical_norm: string;
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
