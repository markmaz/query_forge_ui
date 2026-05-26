import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FlowForgeCommunicationTemplateAIDraft,
  FlowForgeCommunicationTemplateAIDraftRequest,
  FlowForgeCommunicationTemplate,
  FlowForgeCommunicationTemplatePayload,
  FlowForgeCommunicationTemplateTestSendResult,
  FlowForgeCommunicationTemplateValidation,
} from "../model/communicationTemplateTypes";

const headers = () => {
  const workspaceId = getApiWorkspaceId();
  return workspaceId ? { "X-Workspace-Id": workspaceId } : undefined;
};

export async function listFlowForgeCommunicationTemplates(params: {
  status?: string;
  purpose?: string;
  channel?: string;
  resource_set_id?: number | null;
} = {}): Promise<FlowForgeCommunicationTemplate[]> {
  const { data } = await api.get<FlowForgeCommunicationTemplate[]>("/flowforge/communication-templates", {
    headers: headers(),
    params,
  });
  return data;
}

export async function createFlowForgeCommunicationTemplate(
  payload: FlowForgeCommunicationTemplatePayload,
): Promise<FlowForgeCommunicationTemplate> {
  const { data } = await api.post<FlowForgeCommunicationTemplate>("/flowforge/communication-templates", payload, {
    headers: headers(),
  });
  return data;
}

export async function updateFlowForgeCommunicationTemplate(
  templateId: number,
  payload: FlowForgeCommunicationTemplatePayload,
): Promise<FlowForgeCommunicationTemplate> {
  const { data } = await api.patch<FlowForgeCommunicationTemplate>(`/flowforge/communication-templates/${templateId}`, payload, {
    headers: headers(),
  });
  return data;
}

export async function validateFlowForgeCommunicationTemplate(
  templateId: number,
  payload: { preview_context?: Record<string, unknown> },
): Promise<FlowForgeCommunicationTemplateValidation> {
  const { data } = await api.post<FlowForgeCommunicationTemplateValidation>(
    `/flowforge/communication-templates/${templateId}/validate`,
    payload,
    { headers: headers() },
  );
  return data;
}

export async function activateFlowForgeCommunicationTemplate(templateId: number): Promise<FlowForgeCommunicationTemplate> {
  const { data } = await api.post<FlowForgeCommunicationTemplate>(
    `/flowforge/communication-templates/${templateId}/activate`,
    {},
    { headers: headers() },
  );
  return data;
}

export async function sendFlowForgeCommunicationTemplateTest(
  templateId: number,
  payload: { recipient: string; preview_context?: Record<string, unknown> },
): Promise<FlowForgeCommunicationTemplateTestSendResult> {
  const { data } = await api.post<FlowForgeCommunicationTemplateTestSendResult>(
    `/flowforge/communication-templates/${templateId}/test-send`,
    payload,
    { headers: headers() },
  );
  return data;
}

export async function createFlowForgeCommunicationTemplateAIDraft(
  payload: FlowForgeCommunicationTemplateAIDraftRequest,
): Promise<FlowForgeCommunicationTemplateAIDraft> {
  const { data } = await api.post<FlowForgeCommunicationTemplateAIDraft>("/flowforge/communication-templates/ai-drafts", payload, {
    headers: headers(),
  });
  return data;
}
