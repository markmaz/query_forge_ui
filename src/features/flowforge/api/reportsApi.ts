import api, { getApiWorkspaceId } from "@/shared/services/api";
import type { FlowForgeReportDashboard } from "../model/reportTypes";

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
