import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approvePlannerRerankPolicyCandidate,
  createPlannerRerankPolicyCandidate,
  deletePlannerDomainCapability,
  deletePlannerRerankPolicy,
  deletePlannerRerankPolicyCandidate,
  getPlannerDomainCapabilities,
  getPlannerRerankPolicies,
  getPlannerRerankPolicyCandidates,
  suggestPlannerRerankPolicyCandidate,
  upsertPlannerDomainCapability,
  upsertPlannerRerankPolicy,
} from "../api";
import type {
  PlannerDomainCapabilityUpsertRequest,
  PlannerPolicyCandidateReviewStatus,
  PlannerRerankPolicyCandidateApproveRequest,
  PlannerRerankPolicyCandidateCreateRequest,
  PlannerRerankPolicyCandidateSuggestRequest,
  PlannerRerankPolicyUpsertRequest,
} from "../types";

const QUERY_KEY = ["admin", "planner-policies"];

export function usePlannerDomainCapabilities(
  domainId: number | null,
  verticalNorm: string,
  includeInactive: boolean,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "capabilities", domainId, verticalNorm, includeInactive],
    queryFn: () => getPlannerDomainCapabilities(domainId!, verticalNorm, includeInactive),
    enabled: domainId !== null,
    staleTime: 15_000,
  });
}

export function usePlannerRerankPolicies(
  domainId: number | null,
  verticalNorm: string,
  includeInactive: boolean,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "policies", domainId, verticalNorm, includeInactive],
    queryFn: () => getPlannerRerankPolicies(domainId, verticalNorm, includeInactive),
    enabled: domainId !== null,
    staleTime: 15_000,
  });
}

export function usePlannerRerankPolicyCandidates(
  reviewStatus: PlannerPolicyCandidateReviewStatus | "",
  verticalNorm: string,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "candidates", reviewStatus || "all", verticalNorm],
    queryFn: () => getPlannerRerankPolicyCandidates(reviewStatus, verticalNorm),
    staleTime: 15_000,
  });
}

export function useUpsertPlannerDomainCapability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerDomainCapabilityUpsertRequest) => upsertPlannerDomainCapability(payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, "capabilities", variables.base_domain_id],
      });
    },
  });
}

export function useDeletePlannerDomainCapability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (capabilityId: number) => deletePlannerDomainCapability(capabilityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "capabilities"] });
    },
  });
}

export function useUpsertPlannerRerankPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerRerankPolicyUpsertRequest) => upsertPlannerRerankPolicy(payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, "policies", variables.scope_base_domain_id ?? null],
      });
    },
  });
}

export function useDeletePlannerRerankPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: number) => deletePlannerRerankPolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "policies"] });
    },
  });
}

export function useCreatePlannerRerankPolicyCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerRerankPolicyCandidateCreateRequest) =>
      createPlannerRerankPolicyCandidate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "candidates"] });
    },
  });
}

export function useDeletePlannerRerankPolicyCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: number) => deletePlannerRerankPolicyCandidate(candidateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "candidates"] });
    },
  });
}

export function useSuggestPlannerRerankPolicyCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerRerankPolicyCandidateSuggestRequest) =>
      suggestPlannerRerankPolicyCandidate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "candidates"] });
    },
  });
}

export function useApprovePlannerRerankPolicyCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      candidateId,
      payload,
    }: {
      candidateId: number;
      payload: PlannerRerankPolicyCandidateApproveRequest;
    }) => approvePlannerRerankPolicyCandidate(candidateId, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "candidates"] });
      if (variables.payload.scope_base_domain_id) {
        void queryClient.invalidateQueries({
          queryKey: [...QUERY_KEY, "policies", variables.payload.scope_base_domain_id],
        });
      }
    },
  });
}
