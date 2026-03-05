import { useMutation } from "@tanstack/react-query";
import {
  rebuildAll,
  rebuildSemanticConcepts,
  rebuildEmbeddings,
  reindexDomainVectors,
} from "../api";
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

export function useRebuildAll() {
  return useMutation<RebuildAllResponse, Error, RebuildAllRequest>({
    mutationFn: rebuildAll,
  });
}

export function useRebuildSemanticConcepts() {
  return useMutation<
    SemanticConceptRebuildResponse,
    Error,
    SemanticConceptRebuildRequest
  >({
    mutationFn: rebuildSemanticConcepts,
  });
}

export function useRebuildEmbeddings() {
  return useMutation<
    EmbeddingsRebuildResponse,
    Error,
    EmbeddingsRebuildRequest
  >({
    mutationFn: rebuildEmbeddings,
  });
}

export function useReindexDomainVectors() {
  return useMutation<
    DomainVectorReindexResponse,
    Error,
    DomainVectorReindexRequest
  >({
    mutationFn: reindexDomainVectors,
  });
}
