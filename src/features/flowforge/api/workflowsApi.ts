import api from "@/shared/services/api";
import { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FlowForgeRunInspector,
  FlowForgeValidationResult,
  FlowForgeWorkflowAIDraft,
  FlowForgeWorkflowDefinition,
  FlowForgeWorkflowVersion,
} from "../model/types";

const headers = () => {
  const workspaceId = getApiWorkspaceId();
  return workspaceId ? { "X-Workspace-Id": workspaceId } : undefined;
};

export async function listFlowForgeWorkflows(): Promise<FlowForgeWorkflowDefinition[]> {
  const { data } = await api.get<FlowForgeWorkflowDefinition[]>("/flowforge/workflows", {
    headers: headers(),
  });
  return data;
}

export async function createFlowForgeWorkflowDraft(payload: {
  workflow_key: string;
  name: string;
  description?: string;
  graph: FlowForgeWorkflowDefinition["graph"];
}): Promise<FlowForgeWorkflowDefinition> {
  const { data } = await api.post<FlowForgeWorkflowDefinition>("/flowforge/workflows", payload, {
    headers: headers(),
  });
  return data;
}

export async function deleteFlowForgeWorkflow(workflowDefinitionId: number): Promise<{
  deleted: boolean;
  workflow_definition_id: number;
}> {
  const { data } = await api.delete<{
    deleted: boolean;
    workflow_definition_id: number;
  }>(`/flowforge/workflows/${workflowDefinitionId}`, {
    headers: headers(),
  });
  return data;
}

export async function listFlowForgeWorkflowVersions(workflowDefinitionId: number): Promise<FlowForgeWorkflowVersion[]> {
  const { data } = await api.get<FlowForgeWorkflowVersion[]>(`/flowforge/workflows/${workflowDefinitionId}/versions`, {
    headers: headers(),
  });
  return data;
}

export async function createFlowForgeWorkflowVersion(
  workflowDefinitionId: number,
  payload: { graph: FlowForgeWorkflowDefinition["graph"] },
): Promise<FlowForgeWorkflowVersion> {
  const { data } = await api.post<FlowForgeWorkflowVersion>(`/flowforge/workflows/${workflowDefinitionId}/versions`, payload, {
    headers: headers(),
  });
  return data;
}

export async function publishFlowForgeWorkflowVersion(
  workflowDefinitionId: number,
  versionId: number,
): Promise<FlowForgeWorkflowVersion> {
  const { data } = await api.post<FlowForgeWorkflowVersion>(
    `/flowforge/workflows/${workflowDefinitionId}/versions/${versionId}/publish`,
    {},
    { headers: headers() },
  );
  return data;
}

export async function validateFlowForgeGraph(graph: FlowForgeWorkflowDefinition["graph"]): Promise<FlowForgeValidationResult> {
  const { data } = await api.post<FlowForgeValidationResult>(
    "/flowforge/workflows/validate",
    { graph },
    { headers: headers() },
  );
  return data;
}

export async function createFlowForgeWorkflowAIDraft(payload: {
  prompt: string;
  graph: FlowForgeWorkflowDefinition["graph"];
  use_llm?: boolean;
}): Promise<FlowForgeWorkflowAIDraft> {
  const { data } = await api.post<FlowForgeWorkflowAIDraft>("/flowforge/workflows/ai-drafts", payload, {
    headers: headers(),
  });
  return data;
}

export async function getFlowForgeRunInspector(workflowId: string): Promise<FlowForgeRunInspector> {
  const { data } = await api.get<FlowForgeRunInspector>(
    `/flowforge/workflows/${encodeURIComponent(workflowId)}/run-inspector`,
    { headers: headers() },
  );
  return data;
}
