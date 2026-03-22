import api from "../api";
import { parseEntity, parsePaginatedResponse, type PaginatedResult, warnLegacyModelIdUsageOnce } from "./common";
import { toServiceError } from "./errors";
import { appRuntimeConfig } from "../../meta/runtime";
import {
  conceptColumnMapMutationSchema,
  conceptColumnMapSchema,
  type ConceptColumnMap,
  type ConceptColumnMapMutationPayload,
} from "./schemas";

const BASE_PATH = "/semantic/concept-column-maps";

export type ConceptColumnMapListParams = {
  vertical?: string;
  semantic_concept_id?: number;
  workspace_column_id?: number;
  /** @deprecated Workspace-first payloads should not send this field. */
  model_column_id?: number;
  concept_key?: string;
  column_name?: string;
  q?: string;
  relationship_kind?: string;
  page?: number;
  page_size?: number;
};

const toNumericId = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseConceptColumnMapFromResponse = (
  payload: unknown,
  fallback: Omit<ConceptColumnMap, "map_id"> & { map_id?: number }
): ConceptColumnMap => {
  const candidates: unknown[] = [
    payload,
    (payload as { data?: unknown } | null)?.data,
    (payload as { item?: unknown } | null)?.item,
    (payload as { row?: unknown } | null)?.row,
    (payload as { result?: unknown } | null)?.result,
    (payload as { mapping?: unknown } | null)?.mapping,
  ];

  for (const candidate of candidates) {
    const parsed = conceptColumnMapSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return {
    map_id: fallback.map_id ?? 0,
    vertical_norm: fallback.vertical_norm,
    semantic_concept_id: fallback.semantic_concept_id,
    concept_key: fallback.concept_key ?? null,
    concept_name: fallback.concept_name ?? null,
    model_column_id: fallback.model_column_id,
    workspace_column_id: fallback.workspace_column_id,
    column_name: fallback.column_name ?? null,
    workspace_table_name: fallback.workspace_table_name ?? null,
    relationship_kind: fallback.relationship_kind,
    weight: fallback.weight,
    created_at: fallback.created_at ?? null,
  };
};

function buildConceptColumnMapRequest(payload: ConceptColumnMapMutationPayload): ConceptColumnMapMutationPayload {
  const request = conceptColumnMapMutationSchema.parse(payload);
  if (appRuntimeConfig.useWorkspaceIdPayloads) {
    if (request.model_column_id != null) {
      warnLegacyModelIdUsageOnce("conceptColumnMaps.createOrPatch", "model_column_id");
    }
    return {
      vertical_norm: request.vertical_norm,
      semantic_concept_id: request.semantic_concept_id,
      workspace_column_id: request.workspace_column_id,
      relationship_kind: request.relationship_kind,
      weight: request.weight,
    };
  }
  return request;
}

function buildConceptColumnMapListParams(params: ConceptColumnMapListParams): ConceptColumnMapListParams {
  if (!appRuntimeConfig.useWorkspaceIdPayloads || params.model_column_id == null) {
    return params;
  }
  warnLegacyModelIdUsageOnce("conceptColumnMaps.list", "model_column_id");
  const { model_column_id: _ignored, ...rest } = params;
  return rest;
}

export async function listConceptColumnMaps(
  params: ConceptColumnMapListParams
): Promise<PaginatedResult<ConceptColumnMap>> {
  try {
    const response = await api.get(BASE_PATH, { params: buildConceptColumnMapListParams(params) });
    return parsePaginatedResponse(response.data, conceptColumnMapSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load concept-column maps.");
  }
}

export async function getConceptColumnMap(mapId: number): Promise<ConceptColumnMap> {
  try {
    const response = await api.get(`${BASE_PATH}/${mapId}`);
    return parseEntity(response.data, conceptColumnMapSchema, "Invalid concept-column map payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to load concept-column map.");
  }
}

export async function createConceptColumnMap(payload: ConceptColumnMapMutationPayload): Promise<ConceptColumnMap> {
  try {
    const request = buildConceptColumnMapRequest(payload);
    const response = await api.post(BASE_PATH, request);
    const responseId =
      toNumericId((response.data as { map_id?: unknown } | null)?.map_id) ??
      toNumericId((response.data as { id?: unknown } | null)?.id) ??
      toNumericId((response.data as { mapping?: { map_id?: unknown; id?: unknown } } | null)?.mapping?.map_id) ??
      toNumericId((response.data as { mapping?: { map_id?: unknown; id?: unknown } } | null)?.mapping?.id) ??
      null;

    return parseConceptColumnMapFromResponse(response.data, {
      map_id: responseId ?? 0,
      vertical_norm: request.vertical_norm,
      semantic_concept_id: request.semantic_concept_id,
      concept_key: null,
      concept_name: null,
      model_column_id: request.model_column_id ?? null,
      workspace_column_id: request.workspace_column_id,
      column_name: null,
      workspace_table_name: null,
      relationship_kind: request.relationship_kind,
      weight: request.weight,
      created_at: null,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to create concept-column map.");
  }
}

export async function updateConceptColumnMap(
  mapId: number,
  payload: ConceptColumnMapMutationPayload
): Promise<ConceptColumnMap> {
  try {
    const request = buildConceptColumnMapRequest(payload);
    const response = await api.patch(`${BASE_PATH}/${mapId}`, request);
    return parseConceptColumnMapFromResponse(response.data, {
      map_id: mapId,
      vertical_norm: request.vertical_norm,
      semantic_concept_id: request.semantic_concept_id,
      concept_key: null,
      concept_name: null,
      model_column_id: request.model_column_id ?? null,
      workspace_column_id: request.workspace_column_id,
      column_name: null,
      workspace_table_name: null,
      relationship_kind: request.relationship_kind,
      weight: request.weight,
      created_at: null,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to update concept-column map.");
  }
}

export async function deleteConceptColumnMap(mapId: number): Promise<void> {
  try {
    await api.delete(`${BASE_PATH}/${mapId}`);
  } catch (error) {
    throw toServiceError(error, "Unable to delete concept-column map.");
  }
}
