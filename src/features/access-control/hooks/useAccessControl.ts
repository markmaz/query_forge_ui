import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignWorkspaceRole,
  completeWorkspaceOnboarding,
  createMCPAppPrincipal,
  getAccessUser,
  getEffectiveAccessSummary,
  getWorkspaceReadiness,
  listMCPAppPrincipals,
  listAccessRoles,
  listWorkspaceFeatures,
  listWorkspaceRoleAssignments,
  revokeMCPAppPrincipal,
  revokeWorkspaceRole,
  searchAccessUsers,
  updateWorkspaceFeature,
} from "../api";
import type { AccessFeatureKey, MCPAppPrincipalCreatePayload, WorkspaceOnboardingPayload } from "../types";

export const accessControlKeys = {
  all: ["access-control"] as const,
  roles: () => [...accessControlKeys.all, "roles"] as const,
  user: (userId: string | null) => [...accessControlKeys.all, "user", userId] as const,
  userSearch: (query: string) => [...accessControlKeys.all, "user-search", query] as const,
  workspaceRoles: (userId: string | null, workspaceId: string | null) =>
    [...accessControlKeys.all, "workspace-roles", userId, workspaceId] as const,
  effectiveAccess: (userId: string | null, workspaceId: string | null) =>
    [...accessControlKeys.all, "effective-access", userId, workspaceId] as const,
  workspaceFeatures: (workspaceId: string | null) =>
    [...accessControlKeys.all, "workspace-features", workspaceId] as const,
  mcpAppPrincipals: (workspaceId: string | null) =>
    [...accessControlKeys.all, "mcp-app-principals", workspaceId] as const,
  workspaceReadiness: (workspaceId: string | null) =>
    [...accessControlKeys.all, "workspace-readiness", workspaceId] as const,
};

export function useAccessRoles() {
  return useQuery({
    queryKey: accessControlKeys.roles(),
    queryFn: listAccessRoles,
    staleTime: 60_000,
  });
}

export function useAccessUser(userId: string | null | undefined) {
  const normalizedUserId = userId?.trim() || null;
  return useQuery({
    queryKey: accessControlKeys.user(normalizedUserId),
    queryFn: () => getAccessUser(normalizedUserId as string),
    enabled: Boolean(normalizedUserId),
  });
}

export function useAccessUserSearch(query: string) {
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: accessControlKeys.userSearch(normalizedQuery),
    queryFn: () => searchAccessUsers(normalizedQuery),
    enabled: normalizedQuery.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useWorkspaceRoleAssignments(userId: string | null | undefined, workspaceId: string | null | undefined) {
  const normalizedUserId = userId?.trim() || null;
  const normalizedWorkspaceId = workspaceId?.trim() || null;
  return useQuery({
    queryKey: accessControlKeys.workspaceRoles(normalizedUserId, normalizedWorkspaceId),
    queryFn: () => listWorkspaceRoleAssignments(normalizedUserId as string, normalizedWorkspaceId as string),
    enabled: Boolean(normalizedUserId && normalizedWorkspaceId),
    placeholderData: keepPreviousData,
  });
}

export function useAssignWorkspaceRole(userId: string | null | undefined, workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const normalizedUserId = userId?.trim() || null;
  const normalizedWorkspaceId = workspaceId?.trim() || null;

  return useMutation({
    mutationFn: (payload: { role_id?: string; role_key?: string }) =>
      assignWorkspaceRole(normalizedUserId as string, normalizedWorkspaceId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceRoles(normalizedUserId, normalizedWorkspaceId),
      });
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.effectiveAccess(normalizedUserId, normalizedWorkspaceId),
      });
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceReadiness(normalizedWorkspaceId),
      });
    },
  });
}

export function useRevokeWorkspaceRole(userId: string | null | undefined, workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const normalizedUserId = userId?.trim() || null;
  const normalizedWorkspaceId = workspaceId?.trim() || null;

  return useMutation({
    mutationFn: (roleKey: string) =>
      revokeWorkspaceRole(normalizedUserId as string, normalizedWorkspaceId as string, roleKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceRoles(normalizedUserId, normalizedWorkspaceId),
      });
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.effectiveAccess(normalizedUserId, normalizedWorkspaceId),
      });
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceReadiness(normalizedWorkspaceId),
      });
    },
  });
}

export function useWorkspaceFeatures(workspaceId: string | null | undefined) {
  const normalizedWorkspaceId = workspaceId?.trim() || null;
  return useQuery({
    queryKey: accessControlKeys.workspaceFeatures(normalizedWorkspaceId),
    queryFn: () => listWorkspaceFeatures(normalizedWorkspaceId as string),
    enabled: Boolean(normalizedWorkspaceId),
    placeholderData: keepPreviousData,
  });
}

export function useMCPAppPrincipals(workspaceId: string | null | undefined) {
  const normalizedWorkspaceId = workspaceId?.trim() || null;
  return useQuery({
    queryKey: accessControlKeys.mcpAppPrincipals(normalizedWorkspaceId),
    queryFn: () => listMCPAppPrincipals(normalizedWorkspaceId as string),
    enabled: Boolean(normalizedWorkspaceId),
    placeholderData: keepPreviousData,
  });
}

export function useCreateMCPAppPrincipal(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const normalizedWorkspaceId = workspaceId?.trim() || null;

  return useMutation({
    mutationFn: (payload: MCPAppPrincipalCreatePayload) =>
      createMCPAppPrincipal(normalizedWorkspaceId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.mcpAppPrincipals(normalizedWorkspaceId),
      });
    },
  });
}

export function useRevokeMCPAppPrincipal(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const normalizedWorkspaceId = workspaceId?.trim() || null;

  return useMutation({
    mutationFn: (clientId: string) => revokeMCPAppPrincipal(normalizedWorkspaceId as string, clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.mcpAppPrincipals(normalizedWorkspaceId),
      });
    },
  });
}

export function useUpdateWorkspaceFeature(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const normalizedWorkspaceId = workspaceId?.trim() || null;

  return useMutation({
    mutationFn: ({ featureKey, enabled }: { featureKey: AccessFeatureKey; enabled: boolean }) =>
      updateWorkspaceFeature(normalizedWorkspaceId as string, featureKey, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceFeatures(normalizedWorkspaceId),
      });
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceReadiness(normalizedWorkspaceId),
      });
    },
  });
}

export function useEffectiveAccessSummary(userId: string | null | undefined, workspaceId: string | null | undefined) {
  const normalizedUserId = userId?.trim() || null;
  const normalizedWorkspaceId = workspaceId?.trim() || null;
  return useQuery({
    queryKey: accessControlKeys.effectiveAccess(normalizedUserId, normalizedWorkspaceId),
    queryFn: () => getEffectiveAccessSummary(normalizedUserId as string, normalizedWorkspaceId as string),
    enabled: Boolean(normalizedUserId && normalizedWorkspaceId),
    placeholderData: keepPreviousData,
  });
}

export function useWorkspaceReadiness(workspaceId: string | null | undefined) {
  const normalizedWorkspaceId = workspaceId?.trim() || null;
  return useQuery({
    queryKey: accessControlKeys.workspaceReadiness(normalizedWorkspaceId),
    queryFn: () => getWorkspaceReadiness(normalizedWorkspaceId as string),
    enabled: Boolean(normalizedWorkspaceId),
    placeholderData: keepPreviousData,
  });
}

export function useCompleteWorkspaceOnboarding(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const normalizedWorkspaceId = workspaceId?.trim() || null;

  return useMutation({
    mutationFn: (payload: WorkspaceOnboardingPayload) =>
      completeWorkspaceOnboarding(normalizedWorkspaceId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceFeatures(normalizedWorkspaceId),
      });
      await queryClient.invalidateQueries({
        queryKey: accessControlKeys.workspaceReadiness(normalizedWorkspaceId),
      });
    },
  });
}
