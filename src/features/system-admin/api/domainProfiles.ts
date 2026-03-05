import api from "@/shared/services/api";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileUpdateRequest,
  DomainProfileListResponse,
  DomainProfileDeleteResponse,
} from "../types";

export async function listDomainProfiles(): Promise<DomainProfileListResponse> {
  const { data } = await api.get<DomainProfileListResponse>(
    "/admin/domain-profiles"
  );
  return data;
}

export async function getDomainProfile(
  domainId: number
): Promise<DomainProfile> {
  const { data } = await api.get<DomainProfile>(
    `/admin/domain-profiles/${domainId}`
  );
  return data;
}

export async function createDomainProfile(
  body: DomainProfileCreateRequest
): Promise<DomainProfile> {
  const { data } = await api.post<DomainProfile>(
    "/admin/domain-profiles",
    body
  );
  return data;
}

export async function updateDomainProfile(
  domainId: number,
  body: DomainProfileUpdateRequest
): Promise<DomainProfile> {
  const { data } = await api.put<DomainProfile>(
    `/admin/domain-profiles/${domainId}`,
    body
  );
  return data;
}

export async function deleteDomainProfile(
  domainId: number
): Promise<DomainProfileDeleteResponse> {
  const { data } = await api.delete<DomainProfileDeleteResponse>(
    `/admin/domain-profiles/${domainId}`
  );
  return data;
}
