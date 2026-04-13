import api from "../api";
import { parsePaginatedResponse, parseEntity, type PaginatedResult } from "./common";
import { toServiceError } from "./errors";
import {
  conceptKeysResponseSchema,
  conceptMutationSchema,
  semanticConceptSchema,
  type ConceptKeysResponse,
  type ConceptMutationPayload,
  type SemanticConcept,
} from "./schemas";

export type ConceptListParams = {
  q?: string;
  semantic_type?: string;
  page?: number;
  page_size?: number;
};

export type ConceptKeyListParams = Record<string, never>;

const BASE_PATH = "/semantic/concepts";

const toNumericId = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseConceptFromResponse = (
  payload: unknown,
  fallback: Omit<SemanticConcept, "concept_id"> & { concept_id?: number }
): SemanticConcept => {
  const candidates: unknown[] = [
    payload,
    (payload as { data?: unknown } | null)?.data,
    (payload as { item?: unknown } | null)?.item,
    (payload as { row?: unknown } | null)?.row,
    (payload as { result?: unknown } | null)?.result,
    (payload as { concept?: unknown } | null)?.concept,
  ];

  for (const candidate of candidates) {
    const parsed = semanticConceptSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return {
    concept_id: fallback.concept_id ?? 0,
    concept_key: fallback.concept_key,
    name: fallback.name,
    description: fallback.description,
    semantic_type: fallback.semantic_type,
    sub_type: fallback.sub_type,
    entity: fallback.entity,
    granularity_rank: fallback.granularity_rank,
    filter_allowed: fallback.filter_allowed,
    group_by_allowed: fallback.group_by_allowed,
    aggregation_allowed: fallback.aggregation_allowed,
    is_identifier: fallback.is_identifier,
    is_metric: fallback.is_metric,
    display_priority: fallback.display_priority,
    sensitive: fallback.sensitive,
    status: fallback.status,
  };
};

const conceptFallbackFromRequest = (
  request: ConceptMutationPayload,
  conceptId?: number
): Omit<SemanticConcept, "concept_id"> & { concept_id?: number } => ({
  concept_id: conceptId,
  concept_key: request.concept_key,
  name: request.name,
  description: request.description ?? null,
  semantic_type: request.semantic_type,
  sub_type: request.sub_type ?? null,
  entity: request.entity ?? null,
  granularity_rank: request.granularity_rank ?? null,
  filter_allowed: request.filter_allowed,
  group_by_allowed: request.group_by_allowed,
  aggregation_allowed: request.aggregation_allowed,
  is_identifier: request.is_identifier,
  is_metric: request.is_metric,
  display_priority: request.display_priority ?? null,
  sensitive: request.sensitive,
  status: request.status,
});

export async function listConcepts(params: ConceptListParams): Promise<PaginatedResult<SemanticConcept>> {
  try {
    const response = await api.get(BASE_PATH, { params });
    return parsePaginatedResponse(response.data, semanticConceptSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic concepts.");
  }
}

export async function listConceptKeys(params: ConceptKeyListParams = {}): Promise<ConceptKeysResponse> {
  try {
    const response = await api.get(`${BASE_PATH}/keys`);
    return parseEntity(response.data, conceptKeysResponseSchema, "Invalid concept keys payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic concept keys.");
  }
}

export async function createConcept(payload: ConceptMutationPayload): Promise<SemanticConcept> {
  try {
    const request = conceptMutationSchema.parse(payload);
    const response = await api.post(BASE_PATH, request);
    const responseId =
      toNumericId((response.data as { concept_id?: unknown } | null)?.concept_id) ??
      toNumericId((response.data as { id?: unknown } | null)?.id) ??
      null;
    return parseConceptFromResponse(response.data, conceptFallbackFromRequest(request, responseId ?? 0));
  } catch (error) {
    throw toServiceError(error, "Unable to create semantic concept.");
  }
}

export async function updateConcept(conceptId: number, payload: ConceptMutationPayload): Promise<SemanticConcept> {
  try {
    const request = conceptMutationSchema.parse(payload);
    const response = await api.patch(`${BASE_PATH}/${conceptId}`, request);
    return parseConceptFromResponse(response.data, conceptFallbackFromRequest(request, conceptId));
  } catch (error) {
    throw toServiceError(error, "Unable to update semantic concept.");
  }
}

export async function deleteConcept(conceptId: number): Promise<void> {
  try {
    await api.delete(`${BASE_PATH}/${conceptId}`);
  } catch (error) {
    throw toServiceError(error, "Unable to delete semantic concept.");
  }
}

export async function seedConcepts(): Promise<void> {
  try {
    await api.post(`${BASE_PATH}/seed`, {});
  } catch (error) {
    throw toServiceError(error, "Unable to seed semantic concepts.");
  }
}
