import api from "@/shared/services/api";
import type {
  RebuildAllRequest,
  RebuildAllResponse,
  SemanticConceptRebuildRequest,
  SemanticConceptRebuildResponse,
  EmbeddingsRebuildRequest,
  EmbeddingsRebuildResponse,
  DomainVectorReindexRequest,
  DomainVectorReindexResponse,
} from "../types";

export async function rebuildAll(
  body: RebuildAllRequest
): Promise<RebuildAllResponse> {
  const { data } = await api.post<RebuildAllResponse>(
    "/admin/vector/rebuild-all",
    body
  );
  return data;
}

export async function rebuildSemanticConcepts(
  body: SemanticConceptRebuildRequest
): Promise<SemanticConceptRebuildResponse> {
  const { data } = await api.post<SemanticConceptRebuildResponse>(
    "/admin/vector/semantic-concepts/rebuild",
    body
  );
  return data;
}

export async function rebuildEmbeddings(
  body: EmbeddingsRebuildRequest
): Promise<EmbeddingsRebuildResponse> {
  const { data } = await api.post<EmbeddingsRebuildResponse>(
    "/admin/vector/embeddings/rebuild",
    body
  );
  return data;
}

export async function reindexDomainVectors(
  body: DomainVectorReindexRequest
): Promise<DomainVectorReindexResponse> {
  const { data } = await api.post<DomainVectorReindexResponse>(
    "/admin/vector/domains/reindex",
    body
  );
  return data;
}
