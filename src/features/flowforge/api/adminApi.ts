import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FlowForgeIntegrationConfig,
  FlowForgeIntegrationSourceEvent,
  FlowForgeIntegrationSourceField,
  FlowForgeIntegrationTrigger,
  FlowForgeMatchingPolicyLLMDraft,
  FlowForgeMatchingPolicy,
  FlowForgeMatchingPolicyVersion,
  FlowForgeMatchingSimulation,
  FlowForgeResourceRecord,
  FlowForgeResourceRecordListResponse,
  FlowForgeResourceSet,
  FlowForgeWorkspaceSettings,
} from "../model/adminTypes";

const headers = () => {
  const workspaceId = getApiWorkspaceId();
  return workspaceId ? { "X-Workspace-Id": workspaceId } : undefined;
};

export async function listFlowForgeIntegrations(): Promise<FlowForgeIntegrationConfig[]> {
  const { data } = await api.get<FlowForgeIntegrationConfig[]>("/flowforge/integrations", { headers: headers() });
  return data;
}

export async function createJotformIntegration(payload: {
  integration_key: string;
  display_name: string;
  external_form_id?: string;
  mode: string;
  source_events?: FlowForgeIntegrationSourceEvent[];
  source_fields?: FlowForgeIntegrationSourceField[];
}): Promise<FlowForgeIntegrationConfig> {
  const { data } = await api.post<FlowForgeIntegrationConfig>("/flowforge/integrations/jotform", payload, {
    headers: headers(),
  });
  return data;
}

export async function createWebhookIntegration(payload: {
  integration_key: string;
  display_name: string;
  external_form_id?: string;
  mode: string;
  source_events?: FlowForgeIntegrationSourceEvent[];
  source_fields?: FlowForgeIntegrationSourceField[];
}): Promise<FlowForgeIntegrationConfig> {
  const { data } = await api.post<FlowForgeIntegrationConfig>("/flowforge/integrations/webhook", payload, {
    headers: headers(),
  });
  return data;
}

export async function createFlowForgeIntegration(
  provider: string,
  payload: {
    integration_key: string;
    display_name: string;
    external_form_id?: string;
    mode: string;
    source_events?: FlowForgeIntegrationSourceEvent[];
    source_fields?: FlowForgeIntegrationSourceField[];
  },
): Promise<FlowForgeIntegrationConfig> {
  if (provider === "jotform") {
    return createJotformIntegration(payload);
  }
  if (provider === "webhook") {
    return createWebhookIntegration(payload);
  }
  throw new Error(`FlowForge integration provider '${provider}' is not available yet.`);
}

export async function listIntegrationTriggers(integrationId: number): Promise<FlowForgeIntegrationTrigger[]> {
  const { data } = await api.get<FlowForgeIntegrationTrigger[]>(`/flowforge/integrations/${integrationId}/triggers`, {
    headers: headers(),
  });
  return data;
}

export async function createIntegrationTrigger(
  integrationId: number,
  payload: {
    trigger_key: string;
    display_name: string;
    workflow_definition_id: number;
    workflow_version_id?: number | null;
    version_strategy: string;
    priority: number;
    trigger_mode: string;
    trigger_policy: string;
    no_match_config?: Record<string, unknown>;
  },
): Promise<FlowForgeIntegrationTrigger> {
  const { data } = await api.post<FlowForgeIntegrationTrigger>(`/flowforge/integrations/${integrationId}/triggers`, payload, {
    headers: headers(),
  });
  return data;
}

export async function listFlowForgeResourceSets(): Promise<FlowForgeResourceSet[]> {
  const { data } = await api.get<FlowForgeResourceSet[]>("/flowforge/resource-sets", { headers: headers() });
  return data;
}

export async function createFlowForgeResourceSet(payload: {
  resource_set_key: string;
  display_name: string;
  description?: string;
  source_type: string;
}): Promise<FlowForgeResourceSet> {
  const { data } = await api.post<FlowForgeResourceSet>("/flowforge/resource-sets", payload, { headers: headers() });
  return data;
}

export async function updateFlowForgeResourceSet(resourceSetId: number, payload: { enabled: boolean }): Promise<FlowForgeResourceSet> {
  const { data } = await api.patch<FlowForgeResourceSet>(`/flowforge/resource-sets/${resourceSetId}`, payload, { headers: headers() });
  return data;
}

export async function deleteFlowForgeResourceSet(resourceSetId: number): Promise<{ deleted: boolean; resource_set_id: number }> {
  const { data } = await api.delete<{ deleted: boolean; resource_set_id: number }>(`/flowforge/resource-sets/${resourceSetId}`, {
    headers: headers(),
  });
  return data;
}

export async function listFlowForgeResourceRecords(
  resourceSetId: number,
  params: { limit?: number; offset?: number } = {},
): Promise<FlowForgeResourceRecordListResponse> {
  const { data } = await api.get<FlowForgeResourceRecordListResponse>(`/flowforge/resource-sets/${resourceSetId}/records`, {
    headers: headers(),
    params: { limit: params.limit ?? 100, offset: params.offset ?? 0 },
  });
  return data;
}

export async function updateFlowForgeResourceRecord(
  resourceSetId: number,
  recordId: number,
  payload: Record<string, unknown>,
): Promise<FlowForgeResourceRecord> {
  const { data } = await api.patch<FlowForgeResourceRecord>(`/flowforge/resource-sets/${resourceSetId}/records/${recordId}`, payload, {
    headers: headers(),
  });
  return data;
}

export async function deleteFlowForgeResourceRecord(
  resourceSetId: number,
  recordId: number,
): Promise<{ deleted: boolean; resource_set_id: number; resource_record_id: number }> {
  const { data } = await api.delete<{ deleted: boolean; resource_set_id: number; resource_record_id: number }>(
    `/flowforge/resource-sets/${resourceSetId}/records/${recordId}`,
    { headers: headers() },
  );
  return data;
}

export async function createManualResourceSnapshot(
  resourceSetId: number,
  payload: { mode: string; activate: boolean; records: Array<Record<string, unknown>> },
): Promise<{ snapshot_batch_id: number; record_count: number; valid_count: number; invalid_count: number; activated: boolean }> {
  const { data } = await api.post(`/flowforge/resource-sets/${resourceSetId}/snapshot-batches/manual`, payload, {
    headers: headers(),
  });
  return data;
}

export async function listFlowForgeMatchingPolicies(): Promise<FlowForgeMatchingPolicy[]> {
  const { data } = await api.get<FlowForgeMatchingPolicy[]>("/flowforge/matching-policies", { headers: headers() });
  return data;
}

export async function createFlowForgeMatchingPolicy(payload: {
  policy_key: string;
  display_name: string;
  description?: string;
  resource_set_id: number;
  policy?: Record<string, unknown>;
}): Promise<FlowForgeMatchingPolicy> {
  const { data } = await api.post<FlowForgeMatchingPolicy>("/flowforge/matching-policies", payload, { headers: headers() });
  return data;
}

export async function deleteFlowForgeMatchingPolicy(policyId: number): Promise<{ deleted: boolean; matching_policy_id: number; deleted_versions: number }> {
  const { data } = await api.delete<{ deleted: boolean; matching_policy_id: number; deleted_versions: number }>(
    `/flowforge/matching-policies/${policyId}`,
    { headers: headers() },
  );
  return data;
}

export async function listFlowForgeMatchingPolicyVersions(policyId: number): Promise<FlowForgeMatchingPolicyVersion[]> {
  const { data } = await api.get<FlowForgeMatchingPolicyVersion[]>(`/flowforge/matching-policies/${policyId}/versions`, {
    headers: headers(),
  });
  return data;
}

export async function deleteFlowForgeMatchingPolicyVersion(
  policyId: number,
  versionId: number,
): Promise<{ deleted: boolean; matching_policy_id: number; matching_policy_version_id: number }> {
  const { data } = await api.delete<{ deleted: boolean; matching_policy_id: number; matching_policy_version_id: number }>(
    `/flowforge/matching-policies/${policyId}/versions/${versionId}`,
    { headers: headers() },
  );
  return data;
}

export async function createFlowForgeMatchingPolicyLLMDraft(
  policyId: number,
  payload: {
    prompt: string;
    resource_set_id?: number;
    resource_fields?: Array<Record<string, unknown>>;
    context_fields?: Array<Record<string, unknown>>;
    use_llm?: boolean;
  },
): Promise<FlowForgeMatchingPolicyLLMDraft> {
  const { data } = await api.post<FlowForgeMatchingPolicyLLMDraft>(`/flowforge/matching-policies/${policyId}/llm-drafts`, payload, {
    headers: headers(),
  });
  return data;
}

export async function simulateFlowForgeMatchingPolicy(payload: {
  policy: Record<string, unknown>;
  resources: Array<Record<string, unknown>>;
  context: Record<string, unknown>;
}): Promise<FlowForgeMatchingSimulation> {
  const { data } = await api.post<FlowForgeMatchingSimulation>("/flowforge/matching-policies/simulate", payload, {
    headers: headers(),
  });
  return data;
}

export async function getFlowForgeSettings(): Promise<FlowForgeWorkspaceSettings> {
  const { data } = await api.get<FlowForgeWorkspaceSettings>("/flowforge/settings", { headers: headers() });
  return data;
}

export async function updateFlowForgeSettings(payload: Partial<FlowForgeWorkspaceSettings>): Promise<FlowForgeWorkspaceSettings> {
  const { data } = await api.put<FlowForgeWorkspaceSettings>("/flowforge/settings", payload, { headers: headers() });
  return data;
}
