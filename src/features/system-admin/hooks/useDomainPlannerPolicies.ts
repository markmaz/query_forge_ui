import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deletePlannerDomainSelectionPolicy,
  approvePlannerRerankPolicyCandidate,
  createPlannerRerankPolicyCandidate,
  deletePlannerDomainCapability,
  deletePlannerPromptIntentPolicy,
  deletePlannerProjectionPolicy,
  deletePlannerRetrievalPolicy,
  deletePlannerRerankPolicy,
  deletePlannerRerankPolicyCandidate,
  deletePlannerSignalPolicy,
  getPlannerDomainSelectionPolicies,
  getPlannerDomainCapabilities,
  getPlannerPromptIntentPolicies,
  getPlannerProjectionPolicies,
  getPlannerRetrievalPolicies,
  getPlannerRerankPolicies,
  getPlannerRerankPolicyCandidates,
  getPlannerSignalPolicies,
  suggestPlannerRerankPolicyCandidate,
  upsertPlannerDomainSelectionPolicy,
  upsertPlannerDomainCapability,
  upsertPlannerPromptIntentPolicy,
  upsertPlannerProjectionPolicy,
  upsertPlannerRetrievalPolicy,
  upsertPlannerRerankPolicy,
  upsertPlannerSignalPolicy,
} from "../api";
import type {
  PlannerDomainCapabilityRow,
  PlannerProjectionPolicyRow,
  PlannerRerankPolicyRow,
  PlannerDomainSelectionPolicyUpsertRequest,
  PlannerDomainCapabilityUpsertRequest,
  PlannerPolicyCandidateReviewStatus,
  PlannerPromptIntentPolicyUpsertRequest,
  PlannerProjectionPolicyUpsertRequest,
  PlannerRetrievalPolicyUpsertRequest,
  PlannerRerankPolicyCandidateApproveRequest,
  PlannerRerankPolicyCandidateCreateRequest,
  PlannerRerankPolicyCandidateSuggestRequest,
  PlannerRerankPolicyUpsertRequest,
  PlannerSignalPolicyUpsertRequest,
} from "../types";
import type { DomainCoverageRow } from "../ui/domains/plannerPolicies/types";

const QUERY_KEY = ["admin", "planner-policies"];

function countExplicitDomainCapabilities(rows: PlannerDomainCapabilityRow[], domainId: number): number {
  return rows.filter((row) => row.base_domain_id === domainId && row.scope_type.includes("domain")).length;
}

function countExplicitDomainPolicies(rows: PlannerRerankPolicyRow[] | PlannerProjectionPolicyRow[], domainId: number): number {
  return rows.filter((row) => row.scope_base_domain_id === domainId && row.scope_type.includes("domain")).length;
}

export function usePlannerDomainCapabilities(
  domainId: number | null,
  includeInactive: boolean,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "capabilities", domainId, includeInactive],
    queryFn: () => getPlannerDomainCapabilities(domainId!, includeInactive),
    enabled: domainId !== null,
    staleTime: 15_000,
  });
}

export function usePlannerRerankPolicies(
  domainId: number | null,
  includeInactive: boolean,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "policies", domainId, includeInactive],
    queryFn: () => getPlannerRerankPolicies(domainId, includeInactive),
    enabled: domainId !== null,
    staleTime: 15_000,
  });
}

export function usePlannerProjectionPolicies(
  domainId: number | null,
  includeInactive: boolean,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "projection-policies", domainId, includeInactive],
    queryFn: () => getPlannerProjectionPolicies(domainId, includeInactive),
    enabled: domainId !== null,
    staleTime: 15_000,
  });
}

export function usePlannerSignalPolicies(includeInactive: boolean) {
  return useQuery({
    queryKey: [...QUERY_KEY, "signal-policies", includeInactive],
    queryFn: () => getPlannerSignalPolicies(includeInactive),
    staleTime: 15_000,
  });
}

export function usePlannerPromptIntentPolicies(includeInactive: boolean) {
  return useQuery({
    queryKey: [...QUERY_KEY, "prompt-intent-policies", includeInactive],
    queryFn: () => getPlannerPromptIntentPolicies(includeInactive),
    staleTime: 15_000,
  });
}

export function usePlannerRetrievalPolicies(includeInactive: boolean) {
  return useQuery({
    queryKey: [...QUERY_KEY, "retrieval-policies", includeInactive],
    queryFn: () => getPlannerRetrievalPolicies(includeInactive),
    staleTime: 15_000,
  });
}

export function usePlannerDomainSelectionPolicies(includeInactive: boolean) {
  return useQuery({
    queryKey: [...QUERY_KEY, "domain-selection-policies", includeInactive],
    queryFn: () => getPlannerDomainSelectionPolicies(includeInactive),
    staleTime: 15_000,
  });
}

export function usePlannerRerankPolicyCandidates(
  reviewStatus: PlannerPolicyCandidateReviewStatus | "",
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "candidates", reviewStatus || "all"],
    queryFn: () => getPlannerRerankPolicyCandidates(reviewStatus),
    staleTime: 15_000,
  });
}

export function usePlannerDomainCoverage(includeInactive: boolean, domains: Array<{ id: number; name: string }>, enabled: boolean) {
  const rerankPoliciesQuery = useQuery({
    queryKey: [...QUERY_KEY, "coverage", "policies", includeInactive],
    queryFn: () => getPlannerRerankPolicies(null, includeInactive),
    enabled,
    staleTime: 15_000,
  });

  const projectionPoliciesQuery = useQuery({
    queryKey: [...QUERY_KEY, "coverage", "projection-policies", includeInactive],
    queryFn: () => getPlannerProjectionPolicies(null, includeInactive),
    enabled,
    staleTime: 15_000,
  });

  const capabilityQueries = useQueries({
    queries: domains.map((domain) => ({
      queryKey: [...QUERY_KEY, "coverage", "capabilities", domain.id, includeInactive],
      queryFn: () => getPlannerDomainCapabilities(domain.id, includeInactive),
      enabled,
      staleTime: 15_000,
    })),
  });

  const rows = useMemo<DomainCoverageRow[]>(() => {
    const policyRows = rerankPoliciesQuery.data?.policies ?? [];
    const projectionRows = projectionPoliciesQuery.data?.policies ?? [];
    return domains.map((domain, index) => {
      const capabilityRows = capabilityQueries[index]?.data?.capabilities ?? [];
      const capabilityCount = countExplicitDomainCapabilities(capabilityRows, domain.id);
      const policyCount = countExplicitDomainPolicies(policyRows, domain.id);
      const projectionPolicyCount = countExplicitDomainPolicies(projectionRows, domain.id);
      const totalCount = capabilityCount + policyCount + projectionPolicyCount;
      const configuredBuckets = [capabilityCount, policyCount, projectionPolicyCount].filter((count) => count > 0).length;
      const status = totalCount === 0 ? "empty" : configuredBuckets === 3 ? "configured" : "partial";
      return {
        domainId: domain.id,
        domainName: domain.name,
        capabilityCount,
        policyCount,
        projectionPolicyCount,
        totalCount,
        status,
      };
    });
  }, [capabilityQueries, domains, projectionPoliciesQuery.data?.policies, rerankPoliciesQuery.data?.policies]);

  const isLoading =
    enabled &&
    (
      rerankPoliciesQuery.isLoading ||
      projectionPoliciesQuery.isLoading ||
      capabilityQueries.some((query) => query.isLoading)
    );

  return {
    rows,
    isLoading,
  };
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

export function useUpsertPlannerProjectionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerProjectionPolicyUpsertRequest) => upsertPlannerProjectionPolicy(payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, "projection-policies", variables.scope_base_domain_id ?? null],
      });
    },
  });
}

export function useDeletePlannerProjectionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: number) => deletePlannerProjectionPolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "projection-policies"] });
    },
  });
}

export function useUpsertPlannerSignalPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerSignalPolicyUpsertRequest) => upsertPlannerSignalPolicy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "signal-policies"] });
    },
  });
}

export function useDeletePlannerSignalPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: number) => deletePlannerSignalPolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "signal-policies"] });
    },
  });
}

export function useUpsertPlannerPromptIntentPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerPromptIntentPolicyUpsertRequest) => upsertPlannerPromptIntentPolicy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "prompt-intent-policies"] });
    },
  });
}

export function useDeletePlannerPromptIntentPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: number) => deletePlannerPromptIntentPolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "prompt-intent-policies"] });
    },
  });
}

export function useUpsertPlannerRetrievalPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerRetrievalPolicyUpsertRequest) => upsertPlannerRetrievalPolicy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "retrieval-policies"] });
    },
  });
}

export function useDeletePlannerRetrievalPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: number) => deletePlannerRetrievalPolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "retrieval-policies"] });
    },
  });
}

export function useUpsertPlannerDomainSelectionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlannerDomainSelectionPolicyUpsertRequest) =>
      upsertPlannerDomainSelectionPolicy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "domain-selection-policies"] });
    },
  });
}

export function useDeletePlannerDomainSelectionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: number) => deletePlannerDomainSelectionPolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, "domain-selection-policies"] });
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
