import api from "../api";
import { parsePaginatedResponse, type PaginatedResult } from "./common";
import { toServiceError } from "./errors";
import {
  type ValueAlias,
  type ValueAliasMutationPayload,
  valueAliasMutationSchema,
  valueAliasSchema,
} from "./schemas";

const BASE_PATH = "/semantic/value-aliases";

export type ValueAliasListParams = {
  semantic_concept_id?: number;
  q?: string;
  page?: number;
  page_size?: number;
};

const toNumericId = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseValueAliasFromResponse = (
  payload: unknown,
  fallback: Omit<ValueAlias, "value_alias_id"> & { value_alias_id?: number }
): ValueAlias => {
  const candidates: unknown[] = [
    payload,
    (payload as { data?: unknown } | null)?.data,
    (payload as { item?: unknown } | null)?.item,
    (payload as { row?: unknown } | null)?.row,
    (payload as { result?: unknown } | null)?.result,
    (payload as { mapping?: unknown } | null)?.mapping,
  ];

  for (const candidate of candidates) {
    const parsed = valueAliasSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return {
    value_alias_id: fallback.value_alias_id ?? 0,
    semantic_concept_id: fallback.semantic_concept_id,
    concept_key: fallback.concept_key ?? null,
    concept_name: fallback.concept_name ?? null,
    canonical_value: fallback.canonical_value,
    alias_value: fallback.alias_value,
    match_kind: fallback.match_kind,
    weight: fallback.weight,
  };
};

export async function listValueAliases(params: ValueAliasListParams): Promise<PaginatedResult<ValueAlias>> {
  try {
    const response = await api.get(BASE_PATH, { params });
    return parsePaginatedResponse(response.data, valueAliasSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load value aliases.");
  }
}

export async function createValueAlias(payload: ValueAliasMutationPayload): Promise<ValueAlias> {
  try {
    const request = valueAliasMutationSchema.parse(payload);
    const response = await api.post(BASE_PATH, request);
    const responseId =
      toNumericId((response.data as { value_alias_id?: unknown } | null)?.value_alias_id) ??
      toNumericId((response.data as { id?: unknown } | null)?.id) ??
      toNumericId((response.data as { mapping?: { value_alias_id?: unknown; id?: unknown } } | null)?.mapping?.value_alias_id) ??
      toNumericId((response.data as { mapping?: { value_alias_id?: unknown; id?: unknown } } | null)?.mapping?.id) ??
      null;

    return parseValueAliasFromResponse(response.data, {
      value_alias_id: responseId ?? 0,
      semantic_concept_id: request.semantic_concept_id,
      concept_key: null,
      concept_name: null,
      canonical_value: request.canonical_value,
      alias_value: request.alias_value,
      match_kind: request.match_kind,
      weight: request.weight,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to create value alias.");
  }
}

export async function updateValueAlias(
  valueAliasId: number,
  payload: ValueAliasMutationPayload
): Promise<ValueAlias> {
  try {
    const request = valueAliasMutationSchema.parse(payload);
    const response = await api.patch(`${BASE_PATH}/${valueAliasId}`, request);
    return parseValueAliasFromResponse(response.data, {
      value_alias_id: valueAliasId,
      semantic_concept_id: request.semantic_concept_id,
      concept_key: null,
      concept_name: null,
      canonical_value: request.canonical_value,
      alias_value: request.alias_value,
      match_kind: request.match_kind,
      weight: request.weight,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to update value alias.");
  }
}

export async function deleteValueAlias(valueAliasId: number): Promise<void> {
  try {
    await api.delete(`${BASE_PATH}/${valueAliasId}`);
  } catch (error) {
    throw toServiceError(error, "Unable to delete value alias.");
  }
}
