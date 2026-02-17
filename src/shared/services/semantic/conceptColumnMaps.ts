import api from "../api";
import { parseEntity, parsePaginatedResponse, type PaginatedResult } from "./common";
import { toServiceError } from "./errors";
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
  model_column_id?: number;
  relationship_kind?: string;
  page?: number;
  page_size?: number;
};

export async function listConceptColumnMaps(
  params: ConceptColumnMapListParams
): Promise<PaginatedResult<ConceptColumnMap>> {
  try {
    const response = await api.get(BASE_PATH, { params });
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
    const request = conceptColumnMapMutationSchema.parse(payload);
    const response = await api.post(BASE_PATH, request);
    return parseEntity(response.data, conceptColumnMapSchema, "Invalid concept-column map payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to create concept-column map.");
  }
}

export async function updateConceptColumnMap(
  mapId: number,
  payload: ConceptColumnMapMutationPayload
): Promise<ConceptColumnMap> {
  try {
    const request = conceptColumnMapMutationSchema.parse(payload);
    const response = await api.patch(`${BASE_PATH}/${mapId}`, request);
    return parseEntity(response.data, conceptColumnMapSchema, "Invalid concept-column map payload.");
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

