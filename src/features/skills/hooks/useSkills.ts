import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSkill,
  deleteSkill,
  executeSkill,
  listSkillRuns,
  listSkills,
  patchSkillStatus,
  updateSkill,
} from "../api";
import type { SaveSkillPayload, SkillListParams, SkillStatus } from "../types";

export const skillKeys = {
  all: ["skills"] as const,
  list: (params: SkillListParams) => ["skills", "list", params] as const,
  runs: (skillId: string | null) => ["skills", "runs", skillId] as const,
};

export function useSkills(params: SkillListParams) {
  return useQuery({
    queryKey: skillKeys.list(params),
    queryFn: () => listSkills(params),
    placeholderData: (previous) => previous,
  });
}

export function useSkillRuns(skillId: string | null) {
  return useQuery({
    queryKey: skillKeys.runs(skillId),
    queryFn: () => listSkillRuns(skillId!),
    enabled: Boolean(skillId),
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSkillPayload) => createSkill(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.all });
    },
  });
}

export function useUpdateSkill(skillId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSkillPayload) => updateSkill(skillId!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.all });
      if (skillId) {
        void queryClient.invalidateQueries({ queryKey: skillKeys.runs(skillId) });
      }
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillId: string) => deleteSkill(skillId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.all });
    },
  });
}

export function usePatchSkillStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, status }: { skillId: string; status: SkillStatus }) =>
      patchSkillStatus(skillId, status),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.all });
      void queryClient.invalidateQueries({ queryKey: skillKeys.runs(variables.skillId) });
    },
  });
}

export function useExecuteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillId: string) => executeSkill(skillId),
    onSuccess: (_, skillId) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.runs(skillId) });
      void queryClient.invalidateQueries({ queryKey: skillKeys.all });
    },
  });
}
