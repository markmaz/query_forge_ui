import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDomainProfiles,
  getDomainProfile,
  createDomainProfile,
  updateDomainProfile,
  deleteDomainProfile,
} from "../api";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileUpdateRequest,
  DomainProfileDeleteResponse,
  DomainProfileListResponse,
} from "../types";

const QUERY_KEY = ["admin", "domain-profiles"];

export function useDomainProfileList() {
  return useQuery<DomainProfileListResponse>({
    queryKey: QUERY_KEY,
    queryFn: listDomainProfiles,
    staleTime: 15_000,
  });
}

export function useDomainProfile(domainId: number | null) {
  return useQuery<DomainProfile>({
    queryKey: [...QUERY_KEY, domainId],
    queryFn: () => getDomainProfile(domainId!),
    enabled: domainId !== null,
    staleTime: 30_000,
  });
}

export function useCreateDomainProfile() {
  const queryClient = useQueryClient();
  return useMutation<DomainProfile, Error, DomainProfileCreateRequest>({
    mutationFn: createDomainProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateDomainProfile() {
  const queryClient = useQueryClient();
  return useMutation<
    DomainProfile,
    Error,
    { domainId: number; body: DomainProfileUpdateRequest }
  >({
    mutationFn: ({ domainId, body }) => updateDomainProfile(domainId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteDomainProfile() {
  const queryClient = useQueryClient();
  return useMutation<DomainProfileDeleteResponse, Error, number>({
    mutationFn: deleteDomainProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
