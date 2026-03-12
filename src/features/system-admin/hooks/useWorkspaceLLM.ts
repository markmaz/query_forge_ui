import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkspaceLLM,
  deleteWorkspaceLLM,
  listLLMProviders,
  listLLMRoles,
  listWorkspaceLLMs,
  testWorkspaceLLM,
  updateWorkspaceLLM,
} from "../api/workspaceLLMApi";
import type {
  WorkspaceLLMCreateRequest,
  WorkspaceLLMUpdateRequest,
} from "../types";

export const llmKeys = {
  all: ["llm"] as const,
  roles: ["llm", "roles"] as const,
  providers: ["llm", "providers"] as const,
  workspace: (workspaceId: string | null) =>
    ["llm", "workspace-llms", workspaceId] as const,
};

export function useLLMRoles() {
  return useQuery({
    queryKey: llmKeys.roles,
    queryFn: listLLMRoles,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLLMProviders() {
  return useQuery({
    queryKey: llmKeys.providers,
    queryFn: listLLMProviders,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkspaceLLMs(workspaceId: string | null) {
  return useQuery({
    queryKey: llmKeys.workspace(workspaceId),
    queryFn: () => listWorkspaceLLMs(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateWorkspaceLLM(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkspaceLLMCreateRequest) =>
      createWorkspaceLLM(workspaceId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: llmKeys.workspace(workspaceId),
      });
    },
  });
}

export function useUpdateWorkspaceLLM(workspaceId: string, llmId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkspaceLLMUpdateRequest) =>
      updateWorkspaceLLM(workspaceId, llmId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: llmKeys.workspace(workspaceId),
      });
    },
  });
}

export function useDeleteWorkspaceLLM(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (llmId: number) => deleteWorkspaceLLM(workspaceId, llmId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: llmKeys.workspace(workspaceId),
      });
    },
  });
}

export function useTestWorkspaceLLM(workspaceId: string) {
  return useMutation({
    mutationFn: (llmId: number) => testWorkspaceLLM(workspaceId, llmId),
  });
}
