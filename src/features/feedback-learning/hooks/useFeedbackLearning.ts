import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveFeedbackLearningCandidate,
  bulkApproveFeedbackLearningCandidates,
  bulkRejectFeedbackLearningCandidates,
  deactivateFeedbackLearningDomainOverride,
  deactivateFeedbackLearningSemanticOverride,
  getFeedbackLearningCandidateDetail,
  listFeedbackLearningCandidates,
  listFeedbackLearningDomainOverrides,
  listFeedbackLearningPromotionAudits,
  listFeedbackLearningSemanticOverrides,
  rejectFeedbackLearningCandidate,
} from "../api/feedbackLearningApi";
import type {
  FeedbackLearningCandidateFilters,
  FeedbackLearningPromotionAuditFilters,
} from "../model/types";

const CANDIDATE_QUERY_KEY = ["feedback-learning", "candidates"] as const;
const SEMANTIC_OVERRIDE_QUERY_KEY = ["feedback-learning", "semantic-overrides"] as const;
const DOMAIN_OVERRIDE_QUERY_KEY = ["feedback-learning", "domain-overrides"] as const;
const PROMOTION_AUDIT_QUERY_KEY = ["feedback-learning", "promotion-audits"] as const;

export function useFeedbackLearningCandidates(params: FeedbackLearningCandidateFilters) {
  return useQuery({
    queryKey: [...CANDIDATE_QUERY_KEY, params],
    queryFn: () => listFeedbackLearningCandidates(params),
    staleTime: 10_000,
  });
}

export function useFeedbackLearningCandidateDetail(candidateId: number | null) {
  return useQuery({
    queryKey: ["feedback-learning", "candidate-detail", candidateId],
    queryFn: () => getFeedbackLearningCandidateDetail(candidateId as number),
    enabled: candidateId != null,
    staleTime: 10_000,
  });
}

export function useApproveFeedbackLearningCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: number) => approveFeedbackLearningCandidate(candidateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CANDIDATE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: SEMANTIC_OVERRIDE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DOMAIN_OVERRIDE_QUERY_KEY });
    },
  });
}

export function useRejectFeedbackLearningCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, reason }: { candidateId: number; reason: string }) =>
      rejectFeedbackLearningCandidate(candidateId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CANDIDATE_QUERY_KEY });
    },
  });
}

export function useBulkApproveFeedbackLearningCandidates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateIds: number[]) => bulkApproveFeedbackLearningCandidates(candidateIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CANDIDATE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: SEMANTIC_OVERRIDE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DOMAIN_OVERRIDE_QUERY_KEY });
    },
  });
}

export function useBulkRejectFeedbackLearningCandidates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateIds, reason }: { candidateIds: number[]; reason: string }) =>
      bulkRejectFeedbackLearningCandidates(candidateIds, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CANDIDATE_QUERY_KEY });
    },
  });
}

export function useFeedbackLearningSemanticOverrides(workspaceId?: string | null) {
  return useQuery({
    queryKey: [...SEMANTIC_OVERRIDE_QUERY_KEY, workspaceId ?? null],
    queryFn: () => listFeedbackLearningSemanticOverrides(workspaceId ?? undefined),
    staleTime: 10_000,
  });
}

export function useFeedbackLearningDomainOverrides(workspaceId?: string | null) {
  return useQuery({
    queryKey: [...DOMAIN_OVERRIDE_QUERY_KEY, workspaceId ?? null],
    queryFn: () => listFeedbackLearningDomainOverrides(workspaceId ?? undefined),
    staleTime: 10_000,
  });
}

export function useDeactivateFeedbackLearningSemanticOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (overrideId: number) => deactivateFeedbackLearningSemanticOverride(overrideId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEMANTIC_OVERRIDE_QUERY_KEY });
    },
  });
}

export function useDeactivateFeedbackLearningDomainOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (overrideId: number) => deactivateFeedbackLearningDomainOverride(overrideId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOMAIN_OVERRIDE_QUERY_KEY });
    },
  });
}

export function useFeedbackLearningPromotionAudits(
  params: FeedbackLearningPromotionAuditFilters,
) {
  return useQuery({
    queryKey: [...PROMOTION_AUDIT_QUERY_KEY, params],
    queryFn: () => listFeedbackLearningPromotionAudits(params),
    staleTime: 10_000,
  });
}
