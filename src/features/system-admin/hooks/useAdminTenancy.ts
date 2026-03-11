import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  bindWorkspace,
  bootstrapTenancy,
  createWorkspace,
  createOrganization,
  createOrganizationDatasource,
  createOrganizationMembership,
  createWorkspaceMembership,
  deleteDatasource,
  deleteOrganization,
  deleteOrganizationMembership,
  deleteWorkspaceMembership,
  getWorkspaceBinding,
  listOrganizationDatasources,
  listOrganizationMemberships,
  listOrganizations,
  listWorkspaceBindings,
  listWorkspaceMemberships,
  testDatasource,
  updateDatasource,
  updateOrganization,
  updateOrganizationMembership,
  updateWorkspaceBinding,
  updateWorkspaceMembership,
} from "../api";
import type {
  DatasourceInput,
  DatasourceListParams,
  DatasourcePatchInput,
  MembershipInput,
  MembershipPatchInput,
  OrganizationInput,
  OrganizationListParams,
  OrganizationMembershipListParams,
  WorkspaceBindingUpdateRequest,
  WorkspaceCreateRequest,
  TenancyId,
  WorkspaceBindingListParams,
  WorkspaceBindingPatchInput,
  WorkspaceMembershipListParams,
  TenancyBootstrapRequest,
} from "../types";

const tenancyKeys = {
  all: ["admin", "tenancy"] as const,
  organizations: (params: OrganizationListParams) => [...tenancyKeys.all, "organizations", params] as const,
  organizationMemberships: (organizationId: TenancyId | null, params: OrganizationMembershipListParams) =>
    [...tenancyKeys.all, "organizations", organizationId, "memberships", params] as const,
  datasources: (organizationId: TenancyId | null, params: DatasourceListParams) =>
    [...tenancyKeys.all, "organizations", organizationId, "datasources", params] as const,
  workspaceBindings: (params: WorkspaceBindingListParams) => [...tenancyKeys.all, "workspaces", params] as const,
  workspaceBindingDetail: (workspaceId: TenancyId | null) =>
    [...tenancyKeys.all, "workspaces", workspaceId, "binding"] as const,
  workspaceMemberships: (workspaceId: TenancyId | null, params: WorkspaceMembershipListParams) =>
    [...tenancyKeys.all, "workspaces", workspaceId, "memberships", params] as const,
};

export function useOrganizations(params: OrganizationListParams) {
  return useQuery({
    queryKey: tenancyKeys.organizations(params),
    queryFn: () => listOrganizations(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrganizationInput) => createOrganization(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "organizations"] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, payload }: { organizationId: TenancyId; payload: Partial<OrganizationInput> }) =>
      updateOrganization(organizationId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "organizations"] });
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, hard }: { organizationId: TenancyId; hard?: boolean }) =>
      deleteOrganization(organizationId, hard),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "organizations"] });
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
    },
  });
}

export function useOrganizationMemberships(
  organizationId: TenancyId | null,
  params: OrganizationMembershipListParams,
  enabled = true
) {
  return useQuery({
    queryKey: tenancyKeys.organizationMemberships(organizationId, params),
    queryFn: () => listOrganizationMemberships(String(organizationId), params),
    enabled: enabled && Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrganizationMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, payload }: { organizationId: TenancyId; payload: MembershipInput }) =>
      createOrganizationMembership(organizationId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "organizations", variables.organizationId, "memberships"],
      });
    },
  });
}

export function useUpdateOrganizationMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      membershipId,
      payload,
    }: {
      organizationId: TenancyId;
      membershipId: TenancyId;
      payload: MembershipPatchInput;
    }) => updateOrganizationMembership(organizationId, membershipId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "organizations", variables.organizationId, "memberships"],
      });
    },
  });
}

export function useDeleteOrganizationMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, membershipId }: { organizationId: TenancyId; membershipId: TenancyId }) =>
      deleteOrganizationMembership(organizationId, membershipId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "organizations", variables.organizationId, "memberships"],
      });
    },
  });
}

export function useOrganizationDatasources(
  organizationId: TenancyId | null,
  params: DatasourceListParams,
  enabled = true
) {
  return useQuery({
    queryKey: tenancyKeys.datasources(organizationId, params),
    queryFn: () => listOrganizationDatasources(String(organizationId), params),
    enabled: enabled && Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useCreateDatasource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, payload }: { organizationId: TenancyId; payload: DatasourceInput }) =>
      createOrganizationDatasource(organizationId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "organizations", variables.organizationId, "datasources"],
      });
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkspaceCreateRequest) => createWorkspace(payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "workspaces", data.workspace_id, "binding"],
      });
    },
  });
}

export function useUpdateDatasource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ datasourceId, payload }: { datasourceId: TenancyId; payload: DatasourcePatchInput }) =>
      updateDatasource(datasourceId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "organizations"] });
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
    },
  });
}

export function useDeleteDatasource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ datasourceId, hard }: { datasourceId: TenancyId; hard?: boolean }) =>
      deleteDatasource(datasourceId, hard),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "organizations"] });
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
    },
  });
}

export function useTestDatasource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datasourceId: TenancyId) => testDatasource(datasourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "organizations"] });
    },
  });
}

export function useWorkspaceBindings(params: WorkspaceBindingListParams) {
  return useQuery({
    queryKey: tenancyKeys.workspaceBindings(params),
    queryFn: () => listWorkspaceBindings(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useWorkspaceBindingDetail(workspaceId: TenancyId | null, enabled = true) {
  return useQuery({
    queryKey: tenancyKeys.workspaceBindingDetail(workspaceId),
    queryFn: () => getWorkspaceBinding(String(workspaceId)),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useUpdateWorkspaceBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: TenancyId; payload: WorkspaceBindingPatchInput }) =>
      updateWorkspaceBinding(workspaceId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "workspaces", variables.workspaceId, "binding"],
      });
    },
  });
}

export function useBindWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: TenancyId; payload: WorkspaceBindingUpdateRequest }) =>
      bindWorkspace(workspaceId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "workspaces", variables.workspaceId, "binding"],
      });
    },
  });
}

export function useWorkspaceMemberships(
  workspaceId: TenancyId | null,
  params: WorkspaceMembershipListParams,
  enabled = true
) {
  return useQuery({
    queryKey: tenancyKeys.workspaceMemberships(workspaceId, params),
    queryFn: () => listWorkspaceMemberships(String(workspaceId), params),
    enabled: enabled && Boolean(workspaceId),
    placeholderData: keepPreviousData,
  });
}

export function useCreateWorkspaceMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: TenancyId; payload: MembershipInput }) =>
      createWorkspaceMembership(workspaceId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "workspaces", variables.workspaceId, "memberships"],
      });
    },
  });
}

export function useUpdateWorkspaceMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      membershipId,
      payload,
    }: {
      workspaceId: TenancyId;
      membershipId: TenancyId;
      payload: MembershipPatchInput;
    }) => updateWorkspaceMembership(workspaceId, membershipId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "workspaces", variables.workspaceId, "memberships"],
      });
    },
  });
}

export function useDeleteWorkspaceMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, membershipId }: { workspaceId: TenancyId; membershipId: TenancyId }) =>
      deleteWorkspaceMembership(workspaceId, membershipId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...tenancyKeys.all, "workspaces", variables.workspaceId, "memberships"],
      });
    },
  });
}

export function useBootstrapTenancy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TenancyBootstrapRequest) => bootstrapTenancy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "organizations"] });
      void queryClient.invalidateQueries({ queryKey: [...tenancyKeys.all, "workspaces"] });
    },
  });
}
