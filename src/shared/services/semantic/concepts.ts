import api from "../api";
import { parseEntity, parsePaginatedResponse, type PaginatedResult } from "./common";
import { toServiceError } from "./errors";
import {
  conceptMutationSchema,
  semanticConceptSchema,
  type ConceptMutationPayload,
  type SemanticConcept,
} from "./schemas";

export type ConceptListParams = {
  vertical?: string;
  q?: string;
  semantic_type?: string;
  page?: number;
  page_size?: number;
};

const BASE_PATH = "/semantic/concepts";

export async function listConcepts(params: ConceptListParams): Promise<PaginatedResult<SemanticConcept>> {
  try {
    const response = await api.get(BASE_PATH, { params });
    return parsePaginatedResponse(response.data, semanticConceptSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic concepts.");
  }
}

export async function getConcept(conceptId: number): Promise<SemanticConcept> {
  try {
    const response = await api.get(`${BASE_PATH}/${conceptId}`);
    return parseEntity(response.data, semanticConceptSchema, "Invalid concept payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic concept.");
  }
}

export async function createConcept(payload: ConceptMutationPayload): Promise<SemanticConcept> {
  try {
    const request = conceptMutationSchema.parse(payload);
    const response = await api.post(BASE_PATH, request);
    return parseEntity(response.data, semanticConceptSchema, "Invalid concept payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to create semantic concept.");
  }
}

export async function updateConcept(conceptId: number, payload: ConceptMutationPayload): Promise<SemanticConcept> {
  try {
    const request = conceptMutationSchema.parse(payload);
    const response = await api.patch(`${BASE_PATH}/${conceptId}`, request);
    return parseEntity(response.data, semanticConceptSchema, "Invalid concept payload.");
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

export async function seedConcepts(vertical_norm: string): Promise<void> {
  try {
    await api.post(`${BASE_PATH}/seed`, { vertical_norm });
  } catch (error) {
    throw toServiceError(error, "Unable to seed semantic concepts.");
  }
}

