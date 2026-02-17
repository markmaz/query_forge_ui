import api from "../api";
import { parseEntity } from "./common";
import { toServiceError } from "./errors";
import {
  plannerRequestSchema,
  plannerResponseSchema,
  plannerSuggestResponseSchema,
  type PlannerRequest,
  type PlannerResponse,
  type PlannerSuggestResponse,
} from "./schemas";

const PLAN_PATH = "/semantic/plan";
const SUGGEST_COLUMNS_PATH = "/semantic/suggest-columns";

export type PlannerRequestOptions = {
  signal?: AbortSignal;
};

export async function generateSemanticPlan(
  payload: PlannerRequest,
  options: PlannerRequestOptions = {}
): Promise<PlannerResponse> {
  try {
    const request = plannerRequestSchema.parse(payload);
    const response = await api.post(PLAN_PATH, request, { signal: options.signal });
    return parseEntity(response.data, plannerResponseSchema, "Invalid semantic plan response payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to generate semantic plan.");
  }
}

export async function suggestSemanticColumns(
  payload: PlannerRequest,
  options: PlannerRequestOptions = {}
): Promise<PlannerSuggestResponse> {
  try {
    const request = plannerRequestSchema.parse(payload);
    const response = await api.post(SUGGEST_COLUMNS_PATH, request, { signal: options.signal });
    return parseEntity(response.data, plannerSuggestResponseSchema, "Invalid semantic suggest response payload.");
  } catch (error) {
    throw toServiceError(error, "Unable to suggest semantic columns.");
  }
}

