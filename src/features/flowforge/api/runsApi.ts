import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FlowForgeApprovalDecisionRequest,
  FlowForgeApprovalDecisionResponse,
  FlowForgeHumanTaskListResponse,
  FlowForgeHumanTaskQueueResponse,
  FlowForgeNotificationListResponse,
  FlowForgePersistedRun,
  FlowForgePersistedRunEvent,
  FlowForgeRunEventListResponse,
  FlowForgeRunListResponse,
  FlowForgeRunNoteRequest,
} from "../model/runtimeTypes";

const headers = () => {
  const workspaceId = getApiWorkspaceId();
  return workspaceId ? { "X-Workspace-Id": workspaceId } : undefined;
};

export interface FlowForgeRunListParams {
  status?: string | null;
  mode?: string | null;
  limit?: number;
  offset?: number;
}

export async function listFlowForgeRuns(params: FlowForgeRunListParams = {}): Promise<FlowForgeRunListResponse> {
  const { data } = await api.get<FlowForgeRunListResponse>("/flowforge/runs", {
    headers: headers(),
    params: {
      status: params.status || undefined,
      mode: params.mode || undefined,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    },
  });
  return data;
}

export async function getFlowForgeRun(runId: number): Promise<FlowForgePersistedRun> {
  const { data } = await api.get<FlowForgePersistedRun>(`/flowforge/runs/${runId}`, {
    headers: headers(),
  });
  return data;
}

export async function listFlowForgeRunEvents(runId: number, limit = 200): Promise<FlowForgeRunEventListResponse> {
  const { data } = await api.get<FlowForgeRunEventListResponse>(`/flowforge/runs/${runId}/events`, {
    headers: headers(),
    params: { limit },
  });
  return data;
}

export async function listFlowForgeRunHumanTasks(runId: number, limit = 100): Promise<FlowForgeHumanTaskListResponse> {
  const { data } = await api.get<FlowForgeHumanTaskListResponse>(`/flowforge/runs/${runId}/human-tasks`, {
    headers: headers(),
    params: { limit },
  });
  return data;
}

export interface FlowForgeHumanTaskQueueParams {
  task_type?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}

export async function listFlowForgeHumanTasks(
  params: FlowForgeHumanTaskQueueParams = {},
): Promise<FlowForgeHumanTaskQueueResponse> {
  const { data } = await api.get<FlowForgeHumanTaskQueueResponse>("/flowforge/human-tasks", {
    headers: headers(),
    params: {
      task_type: params.task_type || undefined,
      status: params.status || undefined,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    },
  });
  return data;
}

export async function approveFlowForgeHumanTask(
  humanTaskId: number,
  payload: FlowForgeApprovalDecisionRequest,
): Promise<FlowForgeApprovalDecisionResponse> {
  const { data } = await api.post<FlowForgeApprovalDecisionResponse>(
    `/flowforge/human-tasks/${humanTaskId}/approve`,
    payload,
    { headers: headers() },
  );
  return data;
}

export async function declineFlowForgeHumanTask(
  humanTaskId: number,
  payload: FlowForgeApprovalDecisionRequest,
): Promise<FlowForgeApprovalDecisionResponse> {
  const { data } = await api.post<FlowForgeApprovalDecisionResponse>(
    `/flowforge/human-tasks/${humanTaskId}/decline`,
    payload,
    { headers: headers() },
  );
  return data;
}

export async function listFlowForgeRunNotifications(runId: number, limit = 100): Promise<FlowForgeNotificationListResponse> {
  const { data } = await api.get<FlowForgeNotificationListResponse>(`/flowforge/runs/${runId}/notifications`, {
    headers: headers(),
    params: { limit },
  });
  return data;
}

export async function addFlowForgeRunNote(runId: number, payload: FlowForgeRunNoteRequest): Promise<FlowForgePersistedRunEvent> {
  const { data } = await api.post<FlowForgePersistedRunEvent>(`/flowforge/runs/${runId}/notes`, payload, {
    headers: headers(),
  });
  return data;
}
