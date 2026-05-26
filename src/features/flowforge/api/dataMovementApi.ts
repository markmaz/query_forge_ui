import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FlowForgeDataDestination,
  FlowForgeDataMovementAuditListResponse,
  FlowForgeDataMovementConnectionTest,
  FlowForgeDataSource,
  FlowForgeDatasetArtifact,
  FlowForgeDatasetArtifactListResponse,
} from "../model/dataMovementTypes";

const headers = () => {
  const workspaceId = getApiWorkspaceId();
  return workspaceId ? { "X-Workspace-Id": workspaceId } : undefined;
};

export async function listFlowForgeDataSources(): Promise<FlowForgeDataSource[]> {
  const { data } = await api.get<FlowForgeDataSource[]>("/flowforge/data-sources", { headers: headers() });
  return data;
}

export async function upsertFlowForgeDataSource(payload: {
  source_key: string;
  display_name: string;
  source_type: string;
  enabled: boolean;
  mode: string;
  config: Record<string, unknown>;
}): Promise<FlowForgeDataSource> {
  const { data } = await api.post<FlowForgeDataSource>("/flowforge/data-sources", payload, { headers: headers() });
  return data;
}

export async function updateFlowForgeDataSource(sourceKey: string, payload: { enabled: boolean }): Promise<FlowForgeDataSource> {
  const { data } = await api.patch<FlowForgeDataSource>(`/flowforge/data-sources/${encodeURIComponent(sourceKey)}`, payload, {
    headers: headers(),
  });
  return data;
}

export async function testFlowForgeDataSource(sourceKey: string): Promise<FlowForgeDataMovementConnectionTest> {
  const { data } = await api.post<FlowForgeDataMovementConnectionTest>(
    `/flowforge/data-sources/${encodeURIComponent(sourceKey)}/test`,
    {},
    { headers: headers() },
  );
  return data;
}

export async function listFlowForgeDataDestinations(): Promise<FlowForgeDataDestination[]> {
  const { data } = await api.get<FlowForgeDataDestination[]>("/flowforge/data-destinations", { headers: headers() });
  return data;
}

export async function upsertFlowForgeDataDestination(payload: {
  destination_key: string;
  display_name: string;
  destination_type: string;
  enabled: boolean;
  mode: string;
  config: Record<string, unknown>;
}): Promise<FlowForgeDataDestination> {
  const { data } = await api.post<FlowForgeDataDestination>("/flowforge/data-destinations", payload, { headers: headers() });
  return data;
}

export async function updateFlowForgeDataDestination(
  destinationKey: string,
  payload: { enabled: boolean },
): Promise<FlowForgeDataDestination> {
  const { data } = await api.patch<FlowForgeDataDestination>(`/flowforge/data-destinations/${encodeURIComponent(destinationKey)}`, payload, {
    headers: headers(),
  });
  return data;
}

export async function testFlowForgeDataDestination(destinationKey: string): Promise<FlowForgeDataMovementConnectionTest> {
  const { data } = await api.post<FlowForgeDataMovementConnectionTest>(
    `/flowforge/data-destinations/${encodeURIComponent(destinationKey)}/test`,
    {},
    { headers: headers() },
  );
  return data;
}

export async function listFlowForgeDatasetArtifacts(
  params: { runId?: number | null; limit?: number; offset?: number } = {},
): Promise<FlowForgeDatasetArtifactListResponse> {
  const { data } = await api.get<FlowForgeDatasetArtifactListResponse>("/flowforge/dataset-artifacts", {
    headers: headers(),
    params: {
      run_id: params.runId || undefined,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    },
  });
  return data;
}

export async function getFlowForgeDatasetArtifact(artifactId: number): Promise<FlowForgeDatasetArtifact> {
  const { data } = await api.get<FlowForgeDatasetArtifact>(`/flowforge/dataset-artifacts/${artifactId}`, { headers: headers() });
  return data;
}

export async function listFlowForgeDataMovementAudit(
  params: { runId?: number | null; limit?: number; offset?: number } = {},
): Promise<FlowForgeDataMovementAuditListResponse> {
  const { data } = await api.get<FlowForgeDataMovementAuditListResponse>("/flowforge/data-movement-audit", {
    headers: headers(),
    params: {
      run_id: params.runId || undefined,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    },
  });
  return data;
}
