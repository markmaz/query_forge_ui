import api from "../api";
import axios from "axios";
import { toServiceError } from "./errors";

export type RebuildSemanticConceptIndexResponse = {
  message?: string;
  summary?: string;
  [key: string]: unknown;
};

export async function rebuildSemanticConceptVectors(): Promise<RebuildSemanticConceptIndexResponse> {
  try {
    const response = await api.post("/semantic/concepts/rebuild-index", {});
    if (!response.data || typeof response.data !== "object") {
      return {};
    }
    return response.data as RebuildSemanticConceptIndexResponse;
  } catch (error) {
    throw toServiceError(error, "Unable to rebuild concept vector index.");
  }
}

type SemanticPlanIndexRebuildStepId = "concept" | "column_table" | "domain";

type SemanticPlanIndexRebuildStep = {
  id: SemanticPlanIndexRebuildStepId;
  progressLabel: string;
  endpoint: string;
  requestPath: string;
  payload: Record<string, unknown>;
};

export type SemanticPlanIndexRebuildStepResult = {
  id: SemanticPlanIndexRebuildStepId;
  progressLabel: string;
  endpoint: string;
  payload: Record<string, unknown>;
  ok: boolean;
  status: number | null;
  response: unknown;
  errorMessage?: string;
};

export type SemanticPlanIndexRebuildOptions = {
  onStepStart?: (step: SemanticPlanIndexRebuildStep) => void;
  onStepComplete?: (result: SemanticPlanIndexRebuildStepResult) => void;
};

export type SemanticPlanIndexRebuildRequest = {
  workspace_id: string;
};

function normalizeRebuildErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const direct =
      (typeof record.error === "string" && record.error.trim()) ||
      (typeof record.message === "string" && record.message.trim()) ||
      (typeof record.detail === "string" && record.detail.trim()) ||
      null;
    if (direct) return direct;
  }

  return fallback;
}

async function executeRebuildStep(step: SemanticPlanIndexRebuildStep): Promise<SemanticPlanIndexRebuildStepResult> {
  try {
    const response = await api.post(step.requestPath, step.payload);
    return {
      id: step.id,
      progressLabel: step.progressLabel,
      endpoint: step.endpoint,
      payload: step.payload,
      ok: true,
      status: response.status,
      response: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? null;
      const payload = error.response?.data;
      return {
        id: step.id,
        progressLabel: step.progressLabel,
        endpoint: step.endpoint,
        payload: step.payload,
        ok: false,
        status,
        response: payload ?? null,
        errorMessage: normalizeRebuildErrorMessage(payload, error.message || "Request failed."),
      };
    }

    return {
      id: step.id,
      progressLabel: step.progressLabel,
      endpoint: step.endpoint,
      payload: step.payload,
      ok: false,
      status: null,
      response: null,
      errorMessage: error instanceof Error ? error.message : "Request failed.",
    };
  }
}

export async function rebuildSemanticPlanIndexes(
  request: SemanticPlanIndexRebuildRequest,
  options: SemanticPlanIndexRebuildOptions = {}
): Promise<SemanticPlanIndexRebuildStepResult[]> {
  const workspaceId = String(request.workspace_id ?? "").trim();

  const steps: SemanticPlanIndexRebuildStep[] = [
    {
      id: "concept",
      progressLabel: "Rebuilding concept index...",
      endpoint: "/api/v1/semantic/concepts/rebuild-index",
      requestPath: "/semantic/concepts/rebuild-index",
      payload: {},
    },
    {
      id: "column_table",
      progressLabel: "Rebuilding column/table index...",
      endpoint: "/api/v1/embeddings/rebuild",
      requestPath: "/embeddings/rebuild",
      payload: { includeTables: true, workspaceId },
    },
    {
      id: "domain",
      progressLabel: "Rebuilding domain index...",
      endpoint: "/api/v1/embeddings/domains/upsert",
      requestPath: "/embeddings/domains/upsert",
      payload: { workspace_id: workspaceId, force: true },
    },
  ];

  const results: SemanticPlanIndexRebuildStepResult[] = [];
  for (const step of steps) {
    options.onStepStart?.(step);
    const result = await executeRebuildStep(step);
    results.push(result);
    options.onStepComplete?.(result);
  }

  return results;
}
