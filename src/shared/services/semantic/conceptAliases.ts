import api from "../api";
import { parsePaginatedResponse, type PaginatedResult } from "./common";
import { toServiceError } from "./errors";
import {
  conceptAliasMutationSchema,
  conceptAliasSchema,
  type ConceptAlias,
  type ConceptAliasMutationPayload,
} from "./schemas";

const BASE_PATH = "/semantic/concept-aliases";

export type ConceptAliasListParams = {
  concept_key?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

const toNumericId = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseAliasFromResponse = (
  payload: unknown,
  fallback: Omit<ConceptAlias, "alias_id"> & { alias_id?: number }
): ConceptAlias => {
  const candidates: unknown[] = [
    payload,
    (payload as { data?: unknown } | null)?.data,
    (payload as { item?: unknown } | null)?.item,
    (payload as { row?: unknown } | null)?.row,
    (payload as { result?: unknown } | null)?.result,
    (payload as { mapping?: unknown } | null)?.mapping,
  ];

  for (const candidate of candidates) {
    const parsed = conceptAliasSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return {
    alias_id: fallback.alias_id ?? 0,
    alias_key: fallback.alias_key,
    concept_key: fallback.concept_key,
    match_kind: fallback.match_kind,
    weight: fallback.weight,
  };
};

export async function listConceptAliases(params: ConceptAliasListParams = {}): Promise<PaginatedResult<ConceptAlias>> {
  try {
    const response = await api.get(BASE_PATH, { params });
    return parsePaginatedResponse(response.data, conceptAliasSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load concept aliases.");
  }
}

export async function createConceptAlias(payload: ConceptAliasMutationPayload): Promise<ConceptAlias> {
  try {
    const request = conceptAliasMutationSchema.parse(payload);
    const response = await api.post(BASE_PATH, request);
    const responseId =
      toNumericId((response.data as { alias_id?: unknown } | null)?.alias_id) ??
      toNumericId((response.data as { id?: unknown } | null)?.id) ??
      toNumericId((response.data as { mapping?: { alias_id?: unknown; id?: unknown } } | null)?.mapping?.alias_id) ??
      toNumericId((response.data as { mapping?: { alias_id?: unknown; id?: unknown } } | null)?.mapping?.id) ??
      null;

    return parseAliasFromResponse(response.data, {
      alias_id: responseId ?? 0,
      ...request,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to create concept alias.");
  }
}

export async function updateConceptAlias(
  aliasId: number,
  payload: ConceptAliasMutationPayload
): Promise<ConceptAlias> {
  try {
    const request = conceptAliasMutationSchema.parse(payload);
    const response = await api.patch(`${BASE_PATH}/${aliasId}`, request);
    return parseAliasFromResponse(response.data, {
      alias_id: aliasId,
      ...request,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to update concept alias.");
  }
}

export async function deleteConceptAlias(aliasId: number): Promise<void> {
  try {
    await api.delete(`${BASE_PATH}/${aliasId}`);
  } catch (error) {
    throw toServiceError(error, "Unable to delete concept alias.");
  }
}
