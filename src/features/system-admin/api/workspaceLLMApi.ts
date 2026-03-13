import api from "@/shared/services/api";
import type {
  LLMProviderOption,
  LLMRoleOption,
  LLMTestResult,
  WorkspaceLLM,
  WorkspaceLLMCreateRequest,
  WorkspaceLLMUpdateRequest,
} from "../types";

const WORKSPACE_LLM_BASE_PATH = "/workspaces";

function normalizeWorkspaceLLMError(error: unknown, fallback: string): Error {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      response?: {
        status?: number;
        data?: {
          error?: string;
          message?: string;
          details?: unknown;
        };
      };
    };

    const details = candidate.response?.data?.details;
    const detailsMessage =
      typeof details === "string"
        ? details
        : Array.isArray(details)
          ? details.filter((item) => typeof item === "string").join(" ")
          : "";

    const message =
      candidate.response?.data?.error ||
      candidate.response?.data?.message ||
      detailsMessage ||
      candidate.message ||
      fallback;

    return new Error(message);
  }
  return new Error(fallback);
}

export async function listLLMRoles(): Promise<LLMRoleOption[]> {
  try {
    const resp = await api.get<LLMRoleOption[]>("/llm-roles");
    return resp.data;
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to load LLM roles.");
  }
}

export async function listLLMProviders(): Promise<LLMProviderOption[]> {
  try {
    const resp = await api.get<LLMProviderOption[]>("/llm-providers");
    return resp.data;
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to load LLM providers.");
  }
}

export async function listWorkspaceLLMs(
  workspaceId: string,
): Promise<WorkspaceLLM[]> {
  try {
    const resp = await api.get<WorkspaceLLM[]>(
      `${WORKSPACE_LLM_BASE_PATH}/${workspaceId}/llms`,
    );
    return resp.data;
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to load workspace LLM configurations.");
  }
}

export async function getWorkspaceLLM(
  workspaceId: string,
  llmId: number,
): Promise<WorkspaceLLM> {
  try {
    const resp = await api.get<WorkspaceLLM>(
      `${WORKSPACE_LLM_BASE_PATH}/${workspaceId}/llms/${llmId}`,
    );
    return resp.data;
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to load LLM configuration.");
  }
}

export async function createWorkspaceLLM(
  workspaceId: string,
  payload: WorkspaceLLMCreateRequest,
): Promise<WorkspaceLLM> {
  try {
    const resp = await api.post<WorkspaceLLM>(
      `${WORKSPACE_LLM_BASE_PATH}/${workspaceId}/llms`,
      payload,
    );
    return resp.data;
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to create LLM configuration.");
  }
}

export async function updateWorkspaceLLM(
  workspaceId: string,
  llmId: number,
  payload: WorkspaceLLMUpdateRequest,
): Promise<WorkspaceLLM> {
  try {
    const resp = await api.put<WorkspaceLLM>(
      `${WORKSPACE_LLM_BASE_PATH}/${workspaceId}/llms/${llmId}`,
      payload,
    );
    return resp.data;
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to update LLM configuration.");
  }
}

export async function deleteWorkspaceLLM(
  workspaceId: string,
  llmId: number,
): Promise<void> {
  try {
    await api.delete(`${WORKSPACE_LLM_BASE_PATH}/${workspaceId}/llms/${llmId}`);
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to delete LLM configuration.");
  }
}

export async function testWorkspaceLLM(
  workspaceId: string,
  llmId: number,
): Promise<LLMTestResult> {
  try {
    const resp = await api.post<LLMTestResult>(
      `${WORKSPACE_LLM_BASE_PATH}/${workspaceId}/llms/${llmId}/test`,
      {},
    );
    return resp.data;
  } catch (error) {
    throw normalizeWorkspaceLLMError(error, "Failed to test LLM configuration.");
  }
}
