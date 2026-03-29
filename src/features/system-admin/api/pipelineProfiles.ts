import api from "@/shared/services/api";
import type { PipelineProfile, PipelineProfileListResponse } from "../types";

export async function fetchPipelineProfiles(
  limit = 50
): Promise<PipelineProfileListResponse> {
  const { data } = await api.get<PipelineProfileListResponse>(
    "/admin/pipeline-profiles",
    { params: { limit } }
  );
  return data;
}

export async function fetchPipelineProfile(
  traceId: string
): Promise<PipelineProfile> {
  const { data } = await api.get<PipelineProfile>(
    `/admin/pipeline-profiles/${traceId}`
  );
  return data;
}
