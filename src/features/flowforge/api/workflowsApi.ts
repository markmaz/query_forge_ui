import api from "@/shared/services/api";
import { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FlowForgeRunInspector,
  FlowForgeManualRunResponse,
  FlowForgeRunAsPrincipalsResponse,
  FlowForgeValidationResult,
  FlowForgeWorkflowAIDraft,
  FlowForgeWorkflowDefinition,
  FlowForgeWorkflowPermissions,
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

export async function listFlowForgeWorkflowRunAsPrincipals(): Promise<FlowForgeRunAsPrincipalsResponse> {
  const { data } = await api.get<FlowForgeRunAsPrincipalsResponse>("/flowforge/workflows/run-as-principals", {
    headers: headers(),
  });
  return data;
}

export async function getFlowForgeWorkflowPermissions(workflowDefinitionId: number): Promise<FlowForgeWorkflowPermissions> {
  const { data } = await api.get<FlowForgeWorkflowPermissions>(`/flowforge/workflows/${workflowDefinitionId}/permissions`, {
    headers: headers(),
  });
  return data;
}

export async function updateFlowForgeWorkflowPermissions(
  workflowDefinitionId: number,
  payload: {
    grants?: Array<{ principal_type: string; principal_id: string; permission: string }>;
    revocations?: Array<{ principal_type: string; principal_id: string }>;
  },
): Promise<FlowForgeWorkflowPermissions> {
  const { data } = await api.put<FlowForgeWorkflowPermissions>(`/flowforge/workflows/${workflowDefinitionId}/permissions`, payload, {
    headers: headers(),
  });
  return data;
}

export async function updateFlowForgeWorkflowOwner(
  workflowDefinitionId: number,
  ownerUserId: string,
): Promise<FlowForgeWorkflowDefinition> {
  const { data } = await api.put<FlowForgeWorkflowDefinition>(
    `/flowforge/workflows/${workflowDefinitionId}/owner`,
    { owner_user_id: ownerUserId },
    { headers: headers() },
  );
  return data;
}

export async function updateFlowForgeWorkflowRunAs(
  workflowDefinitionId: number,
  payload: { principal_type: string; principal_id: string },
): Promise<FlowForgeWorkflowDefinition> {
  const { data } = await api.put<FlowForgeWorkflowDefinition>(`/flowforge/workflows/${workflowDefinitionId}/run-as`, payload, {
    headers: headers(),
  });
  return data;
}

export async function startFlowForgeWorkflowRun(
  workflowDefinitionId: number,
  payload: { mode?: "test" | "production"; input?: Record<string, unknown>; idempotency_key?: string } = {},
): Promise<FlowForgeManualRunResponse> {
  const { data } = await api.post<FlowForgeManualRunResponse>(`/flowforge/workflows/${workflowDefinitionId}/run`, payload, {
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
  context?: Record<string, unknown>;
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
