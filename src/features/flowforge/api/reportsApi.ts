import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FlowForgeIntakeRawForm,
  FlowForgeIntakeReviewTimeline,
  FlowForgeReportDashboard,
  FlowForgeReportingDomainSync,
} from "../model/reportTypes";

const headers = () => {
  const workspaceId = getApiWorkspaceId();
  return workspaceId ? { "X-Workspace-Id": workspaceId } : undefined;
};

export async function getFlowForgeReportDashboard(mode = "production"): Promise<FlowForgeReportDashboard> {
  const { data } = await api.get<FlowForgeReportDashboard>("/flowforge/reports/dashboard", {
    headers: headers(),
    params: { mode },
  });
  return data;
}

export async function dryRunFlowForgeReportingDomainSync(): Promise<FlowForgeReportingDomainSync> {
  const { data } = await api.post<FlowForgeReportingDomainSync>("/flowforge/reports/domains/sync/dry-run", {}, { headers: headers() });
  return data;
}

export async function syncFlowForgeReportingDomains(): Promise<FlowForgeReportingDomainSync> {
  const { data } = await api.post<FlowForgeReportingDomainSync>("/flowforge/reports/domains/sync", {}, { headers: headers() });
  return data;
}

export async function getFlowForgeIntakeReviewTimeline(mode = "production", days = 7): Promise<FlowForgeIntakeReviewTimeline> {
  const { data } = await api.get<FlowForgeIntakeReviewTimeline>("/flowforge/reports/intake-review", {
    headers: headers(),
    params: { mode, days },
  });
  return data;
}

export async function getFlowForgeIntakeRawForm(intakeEventId: number): Promise<FlowForgeIntakeRawForm> {
  const { data } = await api.get<FlowForgeIntakeRawForm>(`/flowforge/reports/intake-review/${intakeEventId}/raw`, {
    headers: headers(),
  });
  return data;
}
