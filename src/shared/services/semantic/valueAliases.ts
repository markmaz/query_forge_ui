import api from "../api";
import { parseEntity, parsePaginatedResponse, type PaginatedResult } from "./common";
import { toServiceError } from "./errors";
import {
  type ValueAlias,
  type ValueAliasMutationPayload,
  valueAliasMutationSchema,
  valueAliasSchema,
} from "./schemas";

const BASE_PATH = "/semantic/value-aliases";

export type ValueAliasListParams = {
  vertical?: string;
  semantic_concept_id?: number;
  q?: string;
  page?: number;
  page_size?: number;
};

export async function listValueAliases(params: ValueAliasListParams): Promise<PaginatedResult<ValueAlias>> {
  try {
    const response = await api.get(BASE_PATH, { params });
    return parsePaginatedResponse(response.data, valueAliasSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load value aliases.");
  }
}

export async function getValueAlias(valueAliasId: number): Promise<ValueAlias> {
  try {
    const response = await api.get(`${BASE_PATH}/${valueAliasId}`);
    return parseEntity(response.data, valueAliasSchema, "Invalid value alias payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to load value alias.");
  }
}

export async function createValueAlias(payload: ValueAliasMutationPayload): Promise<ValueAlias> {
  try {
    const request = valueAliasMutationSchema.parse(payload);
    const response = await api.post(BASE_PATH, request);
    return parseEntity(response.data, valueAliasSchema, "Invalid value alias payload.");
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
    return parseEntity(response.data, valueAliasSchema, "Invalid value alias payload.");
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

