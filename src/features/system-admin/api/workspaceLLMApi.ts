import api from "@/shared/services/api";
import type {
  LLMProviderOption,
  LLMRoleOption,
  LLMTestResult,
  WorkspaceLLM,
  WorkspaceLLMCreateRequest,
  WorkspaceLLMUpdateRequest,
} from "../types";

export async function listLLMRoles(): Promise<LLMRoleOption[]> {
  const resp = await api.get<LLMRoleOption[]>("/llm-roles");
  return resp.data;
}

export async function listLLMProviders(): Promise<LLMProviderOption[]> {
  const resp = await api.get<LLMProviderOption[]>("/llm-providers");
  return resp.data;
}

export async function listWorkspaceLLMs(
  workspaceId: string,
): Promise<WorkspaceLLM[]> {
  const resp = await api.get<WorkspaceLLM[]>(`/workspaces/${workspaceId}/llms`);
  return resp.data;
}

export async function createWorkspaceLLM(
  workspaceId: string,
  payload: WorkspaceLLMCreateRequest,
): Promise<WorkspaceLLM> {
  const resp = await api.post<WorkspaceLLM>(
    `/workspaces/${workspaceId}/llms`,
    payload,
  );
  return resp.data;
}

export async function updateWorkspaceLLM(
  workspaceId: string,
  llmId: number,
  payload: WorkspaceLLMUpdateRequest,
): Promise<WorkspaceLLM> {
  const resp = await api.put<WorkspaceLLM>(
    `/workspaces/${workspaceId}/llms/${llmId}`,
    payload,
  );
  return resp.data;
}

export async function deleteWorkspaceLLM(
  workspaceId: string,
  llmId: number,
): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/llms/${llmId}`);
}

export async function testWorkspaceLLM(
  workspaceId: string,
  llmId: number,
): Promise<LLMTestResult> {
  const resp = await api.post<LLMTestResult>(
    `/workspaces/${workspaceId}/llms/${llmId}/test`,
  );
  return resp.data;
}
