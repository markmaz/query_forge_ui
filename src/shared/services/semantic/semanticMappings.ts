import api from "../api";
import { appRuntimeConfig } from "../../meta/runtime";
import { parsePaginatedResponse, type PaginatedResult, warnLegacyModelIdUsageOnce } from "./common";
import { toServiceError } from "./errors";
import {
  semanticMappingMutationSchema,
  semanticMappingSchema,
  type SemanticMapping,
  type SemanticMappingMutationPayload,
} from "./schemas";

const BASE_PATH = "/semantic/mappings";

export type SemanticMappingsListParams = {
  vertical?: string;
  workspace_id?: string;
  concept_key?: string;
  workspace_column_id?: number;
  /** @deprecated Workspace-first payloads should not send this field. */
  model_column_id?: number;
  table_name?: string;
  column_name?: string;
  page?: number;
  page_size?: number;
};

function parseSemanticMappingEntity(payload: unknown): SemanticMapping {
  const candidates: unknown[] = [
    payload,
    (payload as { row?: unknown } | null)?.row,
    (payload as { data?: unknown } | null)?.data,
    (payload as { item?: unknown } | null)?.item,
  ];
  for (const candidate of candidates) {
    const parsed = semanticMappingSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  throw new Error("Invalid semantic mapping payload.");
}

function buildSemanticMappingRequest(payload: SemanticMappingMutationPayload): SemanticMappingMutationPayload {
  const request = semanticMappingMutationSchema.parse(payload);
  if (appRuntimeConfig.useWorkspaceIdPayloads) {
    if (request.model_column_id != null) {
      warnLegacyModelIdUsageOnce("semanticMappings.create", "model_column_id");
    }
    return {
      semantic_registry_id: request.semantic_registry_id,
      workspace_id: request.workspace_id,
      workspace_column_id: request.workspace_column_id,
      table_name: request.table_name,
      column_name: request.column_name,
      priority_rank: request.priority_rank,
      confidence_score: request.confidence_score,
    };
  }
  return request;
}

function buildSemanticMappingListParams(params: SemanticMappingsListParams): SemanticMappingsListParams {
  if (!appRuntimeConfig.useWorkspaceIdPayloads || params.model_column_id == null) {
    return params;
  }
  warnLegacyModelIdUsageOnce("semanticMappings.list", "model_column_id");
  const { model_column_id: _ignored, ...rest } = params;
  return rest;
}

export async function listSemanticMappings(
  params: SemanticMappingsListParams
): Promise<PaginatedResult<SemanticMapping>> {
  try {
    const response = await api.get(BASE_PATH, { params: buildSemanticMappingListParams(params) });
    return parsePaginatedResponse(response.data, semanticMappingSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic mappings.");
  }
}

export async function createSemanticMapping(
  payload: SemanticMappingMutationPayload
): Promise<SemanticMapping> {
  try {
    const request = buildSemanticMappingRequest(payload);
    const response = await api.post(BASE_PATH, request);
    return parseSemanticMappingEntity(response.data);
  } catch (error) {
    throw toServiceError(error, "Unable to create semantic mapping.");
  }
}

export async function deleteSemanticMapping(mappingId: number): Promise<void> {
  try {
    await api.delete(`${BASE_PATH}/${mappingId}`);
  } catch (error) {
    throw toServiceError(error, "Unable to delete semantic mapping.");
  }
}
