import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { UserProfile, UserRow } from "@/domain-model/Users";
import {
  useCreateWorkspace,
  useCreateWorkspaceMembership,
  useDatasourceNamespaces,
  useDeleteWorkspace,
  useDeleteWorkspaceMembership,
  useOrganizationDatasources,
  useOrganizations,
  useUpdateWorkspaceBinding,
  useUpdateWorkspaceMembership,
  useWorkspaceBindingDetail,
  useWorkspaceBindings,
  useWorkspaceMemberships,
} from "@/features/system-admin/hooks";
import type {
  TenancyId,
  TenancyMembership,
  WorkspaceBindingDetail,
  WorkspaceBindingPatchInput,
  WorkspaceBindingRow,
  WorkspaceCreateRequest,
} from "@/features/system-admin/types";
import { fetchUserInfo, fetchUsers } from "@/shared/services/users";
import "../systemAdmin.css";

const LIMIT_OPTIONS = [25, 50, 100, 200] as const;

type BindingFormState = {
  organization_id: string;
  datasource_id: string;
  name: string;
  description: string;
  is_active: boolean;
  default_catalog: string;
  default_schema: string;
};

type MembershipFormState = {
  role: string;
  is_active: boolean;
};

type WorkspaceFormState = {
  organization_id: string;
  datasource_id: string;
  workspace_id: string;
  name: string;
  description: string;
  is_active: boolean;
  default_catalog: string;
  default_schema: string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function createBindingFormState(detail?: WorkspaceBindingDetail | null): BindingFormState {
  return {
    organization_id: detail?.organization_id ?? "",
    datasource_id: detail?.datasource_id ?? "",
    name: detail?.workspace_name ?? "",
    description: detail?.description ?? "",
    is_active: detail?.workspace_is_active ?? true,
    default_catalog: detail?.default_catalog ?? "",
    default_schema: detail?.default_schema ?? "",
  };
}

function createWorkspaceFormState(): WorkspaceFormState {
  return {
    organization_id: "",
    datasource_id: "",
    workspace_id: "",
    name: "",
    description: "",
    is_active: true,
    default_catalog: "",
    default_schema: "",
  };
}

function normalizeDisplayText(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const filteredTokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => {
      const lowered = token.toLowerCase();
      return lowered !== "none" && lowered !== "null" && lowered !== "undefined";
    });
  return filteredTokens.join(" ").trim();
}

function buildNamespaceOptions(options: string[], currentValue: string): string[] {
  const seen = new Set<string>();
  const ordered = currentValue.trim() ? [currentValue.trim(), ...options] : [...options];
  return ordered.filter((value) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function TenancyWorkspaceBindingsPage() {
  const [organizationFilter, setOrganizationFilter] = useState<string>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [limit, setLimit] = useState<number>(25);
  const [offset, setOffset] = useState(0);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [bindingForm, setBindingForm] = useState<BindingFormState>(createBindingFormState());
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [createWorkspaceForm, setCreateWorkspaceForm] = useState<WorkspaceFormState>(createWorkspaceFormState());
  const [deletingWorkspace, setDeletingWorkspace] = useState<WorkspaceBindingRow | null>(null);
  const [hardDeleteWorkspace, setHardDeleteWorkspace] = useState(false);
  const [membershipWorkspaceId, setMembershipWorkspaceId] = useState<string | null>(null);
  const [membershipForm, setMembershipForm] = useState<MembershipFormState>({
    role: "",
    is_active: true,
  });
  const [membershipRoleDrafts, setMembershipRoleDrafts] = useState<Record<string, string>>({});
  const [membershipUsersById, setMembershipUsersById] = useState<Record<string, UserProfile | undefined>>({});
  const [membershipSearch, setMembershipSearch] = useState("");
  const [membershipCandidates, setMembershipCandidates] = useState<UserRow[]>([]);
  const [isMembershipCandidatesLoading, setIsMembershipCandidatesLoading] = useState(false);
  const [membershipCandidatesError, setMembershipCandidatesError] = useState<string | null>(null);

  const organizationsQuery = useOrganizations({ include_inactive: true, limit: 500, offset: 0 });

  const bindingsParams = useMemo(
    () => ({
      organization_id: organizationFilter || undefined,
      include_inactive: includeInactive,
      limit,
      offset,
    }),
    [organizationFilter, includeInactive, limit, offset]
  );

  const bindingsQuery = useWorkspaceBindings(bindingsParams);
  const selectedBindingQuery = useWorkspaceBindingDetail(selectedWorkspaceId, Boolean(selectedWorkspaceId));
  const createWorkspaceMutation = useCreateWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();
  const updateBindingMutation = useUpdateWorkspaceBinding();

  const selectedBinding = selectedBindingQuery.data;

  useEffect(() => {
    if (selectedBinding) {
      setBindingForm(createBindingFormState(selectedBinding));
    }
  }, [selectedBinding]);

  const datasourceOptionsQuery = useOrganizationDatasources(
    bindingForm.organization_id || selectedBinding?.organization_id || null,
    { include_inactive: true, limit: 500, offset: 0 },
    Boolean(bindingForm.organization_id || selectedBinding?.organization_id)
  );
  const bindingNamespacesQuery = useDatasourceNamespaces(
    bindingForm.datasource_id || null,
    bindingForm.default_catalog || null,
    Boolean(selectedWorkspaceId && bindingForm.datasource_id)
  );
  const createDatasourceOptionsQuery = useOrganizationDatasources(
    createWorkspaceForm.organization_id || null,
    { include_inactive: true, limit: 500, offset: 0 },
    Boolean(createWorkspaceForm.organization_id)
  );
  const createNamespacesQuery = useDatasourceNamespaces(
    createWorkspaceForm.datasource_id || null,
    createWorkspaceForm.default_catalog || null,
    Boolean(isCreateDrawerOpen && createWorkspaceForm.datasource_id)
  );

  useEffect(() => {
    const namespaces = bindingNamespacesQuery.data;
    if (!namespaces) return;
    setBindingForm((prev) => {
      const nextCatalog = prev.default_catalog || namespaces.current_catalog || "";
      const nextSchema = prev.default_schema || namespaces.current_schema || "";
      if (nextCatalog === prev.default_catalog && nextSchema === prev.default_schema) {
        return prev;
      }
      return { ...prev, default_catalog: nextCatalog, default_schema: nextSchema };
    });
  }, [bindingNamespacesQuery.data]);

  useEffect(() => {
    const namespaces = createNamespacesQuery.data;
    if (!namespaces) return;
    setCreateWorkspaceForm((prev) => {
      const nextCatalog = prev.default_catalog || namespaces.current_catalog || "";
      const nextSchema = prev.default_schema || namespaces.current_schema || "";
      if (nextCatalog === prev.default_catalog && nextSchema === prev.default_schema) {
        return prev;
      }
      return { ...prev, default_catalog: nextCatalog, default_schema: nextSchema };
    });
  }, [createNamespacesQuery.data]);

  const membershipsQuery = useWorkspaceMemberships(
    membershipWorkspaceId,
    { include_inactive: true, limit: 100, offset: 0 },
    Boolean(membershipWorkspaceId)
  );
  const createMembershipMutation = useCreateWorkspaceMembership();
  const updateMembershipMutation = useUpdateWorkspaceMembership();
  const deleteMembershipMutation = useDeleteWorkspaceMembership();
  const membershipUserIdSet = useMemo(
    () => new Set((membershipsQuery.data?.rows ?? []).map((membership) => membership.user_id)),
    [membershipsQuery.data?.rows]
  );
  const filteredMembershipCandidates = useMemo(
    () => membershipCandidates.filter((candidate) => !membershipUserIdSet.has(candidate.user_id)),
    [membershipCandidates, membershipUserIdSet]
  );

  useEffect(() => {
    const memberships = membershipsQuery.data?.rows ?? [];
    if (!membershipWorkspaceId || memberships.length === 0) {
      setMembershipUsersById({});
      return;
    }

    const userIds = [...new Set(memberships.map((membership) => membership.user_id).filter(Boolean))];
    let cancelled = false;

    void Promise.all(
      userIds.map(async (userId) => [userId, await fetchUserInfo(userId)] as const)
    ).then((results) => {
      if (cancelled) return;
      setMembershipUsersById(
        results.reduce<Record<string, UserProfile | undefined>>((acc, [userId, user]) => {
          acc[userId] = user;
          return acc;
        }, {})
      );
    });

    return () => {
      cancelled = true;
    };
  }, [membershipWorkspaceId, membershipsQuery.data?.rows]);

  useEffect(() => {
    if (!membershipWorkspaceId) {
      setMembershipCandidates([]);
      setIsMembershipCandidatesLoading(false);
      setMembershipCandidatesError(null);
      return;
    }

    let cancelled = false;
    setIsMembershipCandidatesLoading(true);
    setMembershipCandidatesError(null);

    const timerId = window.setTimeout(async () => {
      try {
        const response = await fetchUsers("All", 50, "", "", membershipSearch.trim());
        if (cancelled) return;
        setMembershipCandidates(response.users ?? []);
      } catch (error) {
        if (cancelled) return;
        setMembershipCandidates([]);
        setMembershipCandidatesError(toErrorMessage(error, "Unable to load users."));
      } finally {
        if (!cancelled) {
          setIsMembershipCandidatesLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [membershipSearch, membershipWorkspaceId]);

  const rows = bindingsQuery.data?.rows ?? [];
  const total = bindingsQuery.data?.total ?? 0;
  const canGoPrevious = offset > 0;
  const canGoNext = offset + limit < total;
  const bindingCatalogOptions = useMemo(
    () => buildNamespaceOptions(bindingNamespacesQuery.data?.catalogs ?? [], bindingForm.default_catalog),
    [bindingNamespacesQuery.data?.catalogs, bindingForm.default_catalog]
  );
  const bindingSchemaOptions = useMemo(
    () => buildNamespaceOptions(bindingNamespacesQuery.data?.schemas ?? [], bindingForm.default_schema),
    [bindingNamespacesQuery.data?.schemas, bindingForm.default_schema]
  );
  const createCatalogOptions = useMemo(
    () => buildNamespaceOptions(createNamespacesQuery.data?.catalogs ?? [], createWorkspaceForm.default_catalog),
    [createNamespacesQuery.data?.catalogs, createWorkspaceForm.default_catalog]
  );
  const createSchemaOptions = useMemo(
    () => buildNamespaceOptions(createNamespacesQuery.data?.schemas ?? [], createWorkspaceForm.default_schema),
    [createNamespacesQuery.data?.schemas, createWorkspaceForm.default_schema]
  );

  const handleSaveBinding = () => {
    if (!selectedWorkspaceId) return;

    const payload: WorkspaceBindingPatchInput = {
      organization_id: bindingForm.organization_id || null,
      datasource_id: bindingForm.datasource_id || null,
      name: bindingForm.name.trim() || undefined,
      description: bindingForm.description.trim() || null,
      is_active: bindingForm.is_active,
      default_catalog: bindingForm.default_catalog.trim() || null,
      default_schema: bindingForm.default_schema.trim() || null,
    };

    updateBindingMutation.mutate(
      {
        workspaceId: selectedWorkspaceId,
        payload,
      },
      {
        onSuccess: () => {
          toast.success("Workspace binding updated.");
        },
        onError: (error) => toast.error(toErrorMessage(error, "Unable to update workspace binding.")),
      }
    );
  };

  const handleCreateWorkspace = () => {
    const payload: WorkspaceCreateRequest = {
      organization_id: createWorkspaceForm.organization_id,
      datasource_id: createWorkspaceForm.datasource_id ? Number(createWorkspaceForm.datasource_id) : null,
      workspace_id: createWorkspaceForm.workspace_id.trim() || undefined,
      name: createWorkspaceForm.name.trim() || undefined,
      description: createWorkspaceForm.description.trim() || null,
      is_active: createWorkspaceForm.is_active,
      default_catalog: createWorkspaceForm.default_catalog.trim() || null,
      default_schema: createWorkspaceForm.default_schema.trim() || null,
    };

    if (!payload.organization_id) {
      toast.error("Organization is required.");
      return;
    }
    if (!payload.workspace_id && !payload.name) {
      toast.error("Workspace name or workspace id is required.");
      return;
    }

    createWorkspaceMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Workspace created.");
        setCreateWorkspaceForm(createWorkspaceFormState());
        setIsCreateDrawerOpen(false);
      },
      onError: (error) => toast.error(toErrorMessage(error, "Unable to create workspace.")),
    });
  };

  const handleDeleteWorkspace = () => {
    if (!deletingWorkspace) return;
    deleteWorkspaceMutation.mutate(
      {
        workspaceId: deletingWorkspace.workspace_id,
        hard: hardDeleteWorkspace,
      },
      {
        onSuccess: () => {
          toast.success(hardDeleteWorkspace ? "Workspace hard deleted." : "Workspace deleted.");
          if (selectedWorkspaceId === deletingWorkspace.workspace_id) {
            setSelectedWorkspaceId(null);
          }
          if (membershipWorkspaceId === deletingWorkspace.workspace_id) {
            setMembershipWorkspaceId(null);
          }
          setDeletingWorkspace(null);
          setHardDeleteWorkspace(false);
        },
        onError: (error) => toast.error(toErrorMessage(error, "Unable to delete workspace.")),
      }
    );
  };

  const closeCreateDrawer = () => {
    if (createWorkspaceMutation.isPending) return;
    setIsCreateDrawerOpen(false);
  };

  const closeMembershipDrawer = () => {
    if (
      createMembershipMutation.isPending ||
      updateMembershipMutation.isPending ||
      deleteMembershipMutation.isPending
    ) {
      return;
    }
    setMembershipWorkspaceId(null);
    setMembershipSearch("");
  };

  const getMembershipDisplayName = (membership: TenancyMembership): string => {
    const profile = membershipUsersById[membership.user_id];
    const fullName = [
      normalizeDisplayText(profile?.first_name),
      normalizeDisplayText(profile?.last_name),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    return (
      normalizeDisplayText(profile?.display_name) ||
      fullName ||
      normalizeDisplayText(profile?.user_name) ||
      membership.user_id
    );
  };

  const handleCreateMembership = (userId: string) => {
    if (!membershipWorkspaceId) return;
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return;

    createMembershipMutation.mutate(
      {
        workspaceId: membershipWorkspaceId,
        payload: {
          user_id: normalizedUserId,
          role: membershipForm.role.trim() || null,
          is_active: membershipForm.is_active,
        },
      },
      {
        onSuccess: () => {
          toast.success("Membership added.");
          setMembershipForm({ role: "", is_active: true });
          setMembershipSearch("");
        },
        onError: (error) => toast.error(toErrorMessage(error, "Unable to add membership.")),
      }
    );
  };

  const saveMembershipRole = (membership: TenancyMembership) => {
    if (!membershipWorkspaceId) return;
    const role = (membershipRoleDrafts[membership.membership_id] ?? membership.role ?? "").trim();

    updateMembershipMutation.mutate(
      {
        workspaceId: membershipWorkspaceId,
        membershipId: membership.membership_id,
        payload: {
          role: role || null,
        },
      },
      {
        onSuccess: () => toast.success("Membership updated."),
        onError: (error) => toast.error(toErrorMessage(error, "Unable to update membership.")),
      }
    );
  };

  const toggleMembershipActive = (membership: TenancyMembership, nextActive: boolean) => {
    if (!membershipWorkspaceId) return;

    updateMembershipMutation.mutate(
      {
        workspaceId: membershipWorkspaceId,
        membershipId: membership.membership_id,
        payload: {
          is_active: nextActive,
        },
      },
      {
        onSuccess: () => toast.success("Membership status updated."),
        onError: (error) => toast.error(toErrorMessage(error, "Unable to update membership status.")),
      }
    );
  };

  const removeMembership = (membershipId: TenancyId) => {
    if (!membershipWorkspaceId) return;

    deleteMembershipMutation.mutate(
      {
        workspaceId: membershipWorkspaceId,
        membershipId,
      },
      {
        onSuccess: () => toast.success("Membership deleted."),
        onError: (error) => toast.error(toErrorMessage(error, "Unable to delete membership.")),
      }
    );
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Workspaces</h1>
          <p className="sa-page-subtitle">Manage workspace records, organization assignment, datasource binding, and memberships.</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            setCreateWorkspaceForm(createWorkspaceFormState());
            setIsCreateDrawerOpen(true);
          }}
        >
          <i className="fa fa-plus" /> New Workspace
        </button>
      </div>

      <div className="sa-toolbar">
        <label className="sa-field mb-0" style={{ minWidth: 260 }}>
          <span>Organization filter</span>
          <select
            className="form-select form-select-sm"
            value={organizationFilter}
            onChange={(event) => {
              setOrganizationFilter(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">All organizations</option>
            {(organizationsQuery.data?.rows ?? []).map((org) => (
              <option key={org.organization_id} value={org.organization_id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>

        <label className="sa-field mb-0">
          <span>Limit</span>
          <select
            className="form-select form-select-sm"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setOffset(0);
            }}
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="form-check mb-0 mt-3">
          <input
            className="form-check-input"
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => {
              setIncludeInactive(event.target.checked);
              setOffset(0);
            }}
          />
          <span className="form-check-label">Include inactive</span>
        </label>

        <button
          type="button"
          className="btn btn-sm btn-outline-primary mt-3"
          onClick={() => void bindingsQuery.refetch()}
          disabled={bindingsQuery.isFetching}
        >
          <i className="fa fa-refresh" /> Refresh
        </button>
      </div>

      {bindingsQuery.isError && (
        <div className="alert alert-danger" role="alert">
          {toErrorMessage(bindingsQuery.error, "Unable to load workspace bindings.")}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          {total} workspaces
        </span>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!canGoPrevious || bindingsQuery.isFetching}
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!canGoNext || bindingsQuery.isFetching}
            onClick={() => setOffset((prev) => prev + limit)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>Workspace ID</th>
              <th>Workspace Name</th>
              <th>Organization</th>
              <th>Datasource</th>
              <th>Datasource Type</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.workspace_id}
                className="expandable"
                onClick={() => setSelectedWorkspaceId(row.workspace_id)}
              >
                <td>{row.workspace_id}</td>
                <td>{row.workspace_name}</td>
                <td>{row.organization_name ?? "-"}</td>
                <td>{row.datasource_name ?? "-"}</td>
                <td>{row.datasource_type ?? "-"}</td>
                <td>
                  <span className={row.workspace_is_active ? "badge text-bg-success" : "badge text-bg-secondary"}>
                    {row.workspace_is_active ? "active" : "inactive"}
                  </span>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      aria-label={`Open memberships for ${row.workspace_id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMembershipWorkspaceId(row.workspace_id);
                      }}
                    >
                      <i className="fa fa-users" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      aria-label={`Delete workspace ${row.workspace_id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingWorkspace(row);
                        setHardDeleteWorkspace(false);
                      }}
                    >
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!bindingsQuery.isFetching && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  No workspace bindings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedWorkspaceId && (
        <>
          <div className="sa-drawer-backdrop" onClick={() => setSelectedWorkspaceId(null)} />
          <aside className="sa-drawer" role="dialog" aria-label={`Workspace binding ${selectedWorkspaceId}`}>
            <div className="sa-drawer-header">
              <h2>Workspace Binding</h2>
              <button type="button" className="btn btn-sm btn-light" onClick={() => setSelectedWorkspaceId(null)}>
                <i className="fa fa-xmark" />
              </button>
            </div>
            <div className="sa-drawer-body">
              {selectedBindingQuery.isLoading && <div className="sa-loading">Loading binding details…</div>}
              {selectedBindingQuery.isError && (
                <div className="alert alert-danger" role="alert">
                  {toErrorMessage(selectedBindingQuery.error, "Unable to load binding details.")}
                </div>
              )}

              {selectedBinding && (
                <div className="d-flex flex-column gap-3">
                  <div className="sa-drawer-form-card">
                    <h3 className="sa-drawer-form-card-title">Workspace</h3>
                    <div className="sa-detail-meta mt-2">
                      <div className="sa-detail-meta-item">
                        <span className="label">Workspace ID:</span> <span className="value">{selectedBinding.workspace_id}</span>
                      </div>
                      <div className="sa-detail-meta-item">
                        <span className="label">Datasource:</span> <span className="value">{selectedBinding.datasource_name ?? "-"}</span>
                      </div>
                      <div className="sa-detail-meta-item">
                        <span className="label">Organization:</span> <span className="value">{selectedBinding.organization_name ?? "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="sa-drawer-form-card">
                    <h3 className="sa-drawer-form-card-title">Edit Binding</h3>
                    <div className="row g-3 mt-1">
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Name</label>
                          <input
                            className="form-control"
                            value={bindingForm.name}
                            onChange={(event) => setBindingForm((prev) => ({ ...prev, name: event.target.value }))}
                          />
                        </label>
                      </div>

                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Organization</label>
                          <select
                            className="form-select"
                            value={bindingForm.organization_id}
                            onChange={(event) => {
                              const nextOrgId = event.target.value;
                              setBindingForm((prev) => ({
                                ...prev,
                                organization_id: nextOrgId,
                                datasource_id: "",
                                default_catalog: "",
                                default_schema: "",
                              }));
                            }}
                          >
                            <option value="">None</option>
                            {(organizationsQuery.data?.rows ?? []).map((org) => (
                              <option key={org.organization_id} value={org.organization_id}>
                                {org.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Datasource</label>
                          <select
                            className="form-select"
                            value={bindingForm.datasource_id}
                            onChange={(event) =>
                              setBindingForm((prev) => ({
                                ...prev,
                                datasource_id: event.target.value,
                                default_catalog: "",
                                default_schema: "",
                              }))
                            }
                            disabled={!bindingForm.organization_id}
                          >
                            <option value="">None</option>
                            {(datasourceOptionsQuery.data?.rows ?? []).map((datasource) => (
                              <option key={datasource.datasource_id} value={datasource.datasource_id}>
                                {datasource.name} ({datasource.type})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Description</label>
                          <textarea
                            className="form-control"
                            rows={3}
                            value={bindingForm.description}
                            onChange={(event) =>
                              setBindingForm((prev) => ({ ...prev, description: event.target.value }))
                            }
                          />
                        </label>
                      </div>

                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Default Catalog</label>
                          <select
                            className="form-select"
                            value={bindingForm.default_catalog}
                            onChange={(event) =>
                              setBindingForm((prev) => ({
                                ...prev,
                                default_catalog: event.target.value,
                                default_schema: "",
                              }))
                            }
                            disabled={!bindingForm.datasource_id || bindingNamespacesQuery.isLoading}
                          >
                            <option value="">
                              {bindingForm.datasource_id
                                ? bindingNamespacesQuery.isLoading
                                  ? "Loading catalogs..."
                                  : "Select catalog"
                                : "Select a datasource first"}
                            </option>
                            {bindingCatalogOptions.map((catalog) => (
                              <option key={catalog} value={catalog}>
                                {catalog}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Default Schema</label>
                          <select
                            className="form-select"
                            value={bindingForm.default_schema}
                            onChange={(event) =>
                              setBindingForm((prev) => ({ ...prev, default_schema: event.target.value }))
                            }
                            disabled={!bindingForm.datasource_id || bindingNamespacesQuery.isLoading}
                          >
                            <option value="">
                              {bindingForm.datasource_id
                                ? bindingNamespacesQuery.isLoading
                                  ? "Loading schemas..."
                                  : "Select schema"
                                : "Select a datasource first"}
                            </option>
                            {bindingSchemaOptions.map((schema) => (
                              <option key={schema} value={schema}>
                                {schema}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="col-12">
                        <label className="form-check mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={bindingForm.is_active}
                            onChange={(event) =>
                              setBindingForm((prev) => ({ ...prev, is_active: event.target.checked }))
                            }
                          />
                          <span className="form-check-label">Workspace active</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="sa-drawer-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setSelectedWorkspaceId(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleSaveBinding}
                disabled={updateBindingMutation.isPending || !selectedBinding}
              >
                Save Binding
              </button>
            </div>
          </aside>
        </>
      )}

      {isCreateDrawerOpen && (
        <>
          <div className="sa-drawer-backdrop" onClick={closeCreateDrawer} />
          <aside className="sa-drawer" role="dialog" aria-label="Create workspace">
            <div className="sa-drawer-header">
              <h2>Create Workspace</h2>
              <button
                type="button"
                className="btn btn-sm btn-light"
                aria-label="Close create workspace drawer"
                onClick={closeCreateDrawer}
              >
                <i className="fa fa-xmark" />
              </button>
            </div>
            <div className="sa-drawer-body">
              <div className="sa-drawer-form-card">
                <div className="row g-3 mt-1">
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Organization</label>
                      <select
                        className="form-select"
                        value={createWorkspaceForm.organization_id}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({
                            ...prev,
                            organization_id: event.target.value,
                            datasource_id: "",
                            default_catalog: "",
                            default_schema: "",
                          }))
                        }
                      >
                        <option value="">Select organization</option>
                        {(organizationsQuery.data?.rows ?? []).map((org) => (
                          <option key={org.organization_id} value={org.organization_id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Datasource</label>
                      <select
                        className="form-select"
                        value={createWorkspaceForm.datasource_id}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({
                            ...prev,
                            datasource_id: event.target.value,
                            default_catalog: "",
                            default_schema: "",
                          }))
                        }
                        disabled={!createWorkspaceForm.organization_id}
                      >
                        <option value="">None</option>
                        {(createDatasourceOptionsQuery.data?.rows ?? []).map((datasource) => (
                          <option key={datasource.datasource_id} value={datasource.datasource_id}>
                            {datasource.name} ({datasource.type})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Workspace ID (optional)</label>
                      <input
                        className="form-control"
                        value={createWorkspaceForm.workspace_id}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({ ...prev, workspace_id: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Workspace Name</label>
                      <input
                        className="form-control"
                        value={createWorkspaceForm.name}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Description</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={createWorkspaceForm.description}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Default Catalog</label>
                      <select
                        className="form-select"
                        value={createWorkspaceForm.default_catalog}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({
                            ...prev,
                            default_catalog: event.target.value,
                            default_schema: "",
                          }))
                        }
                        disabled={!createWorkspaceForm.datasource_id || createNamespacesQuery.isLoading}
                      >
                        <option value="">
                          {createWorkspaceForm.datasource_id
                            ? createNamespacesQuery.isLoading
                              ? "Loading catalogs..."
                              : "Select catalog"
                            : "Select a datasource first"}
                        </option>
                        {createCatalogOptions.map((catalog) => (
                          <option key={catalog} value={catalog}>
                            {catalog}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Default Schema</label>
                      <select
                        className="form-select"
                        value={createWorkspaceForm.default_schema}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({ ...prev, default_schema: event.target.value }))
                        }
                        disabled={!createWorkspaceForm.datasource_id || createNamespacesQuery.isLoading}
                      >
                        <option value="">
                          {createWorkspaceForm.datasource_id
                            ? createNamespacesQuery.isLoading
                              ? "Loading schemas..."
                              : "Select schema"
                            : "Select a datasource first"}
                        </option>
                        {createSchemaOptions.map((schema) => (
                          <option key={schema} value={schema}>
                            {schema}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={createWorkspaceForm.is_active}
                        onChange={(event) =>
                          setCreateWorkspaceForm((prev) => ({ ...prev, is_active: event.target.checked }))
                        }
                      />
                      <span className="form-check-label">Workspace active on create</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="sa-drawer-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={closeCreateDrawer}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleCreateWorkspace}
                disabled={createWorkspaceMutation.isPending}
              >
                {createWorkspaceMutation.isPending ? "Creating..." : "Create Workspace"}
              </button>
            </div>
          </aside>
        </>
      )}

      {membershipWorkspaceId && (
        <>
          <div className="sa-drawer-backdrop" onClick={closeMembershipDrawer} />
          <aside
            className="sa-drawer sa-workspace-memberships-drawer"
            role="dialog"
            aria-label={`Workspace memberships ${membershipWorkspaceId}`}
          >
            <div className="sa-drawer-header">
              <h2>Workspace Memberships</h2>
              <button
                type="button"
                className="btn btn-sm btn-light"
                aria-label="Close workspace memberships drawer"
                onClick={closeMembershipDrawer}
              >
                <i className="fa fa-xmark" />
              </button>
            </div>
            <div className="sa-drawer-body">
              <div className="sa-drawer-form-card mb-3">
                <h3 className="sa-drawer-form-card-title">Add Membership</h3>
                <div className="row g-2 mt-1">
                  <div className="col-md-6">
                    <label className="sa-field mb-0">
                      <span>Search users</span>
                      <input
                        aria-label="Search users"
                        className="form-control form-control-sm"
                        placeholder="Search by username, first name, last name, or email"
                        value={membershipSearch}
                        onChange={(event) => setMembershipSearch(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="col-md-3">
                    <label className="sa-field mb-0">
                      <span>Role</span>
                      <input
                        aria-label="Membership role"
                        className="form-control form-control-sm"
                        placeholder="role"
                        value={membershipForm.role}
                        onChange={(event) => setMembershipForm((prev) => ({ ...prev, role: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="col-md-3 d-flex align-items-center">
                    <label className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={membershipForm.is_active}
                        onChange={(event) => setMembershipForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                      />
                      <span className="form-check-label">Active</span>
                    </label>
                  </div>
                </div>
                <div className="sa-membership-user-picker mt-2">
                  {isMembershipCandidatesLoading && (
                    <div className="text-muted small py-2">
                      <span className="sa-spinner" /> Loading users
                    </div>
                  )}
                  {membershipCandidatesError && !isMembershipCandidatesLoading && (
                    <div className="alert alert-danger py-2 mb-2" role="alert">
                      {membershipCandidatesError}
                    </div>
                  )}
                  {!isMembershipCandidatesLoading &&
                    !membershipCandidatesError &&
                    filteredMembershipCandidates.length === 0 && (
                      <div className="text-muted small py-2">
                        {membershipSearch.trim().length > 0 ? "No matching users found." : "No users available to add."}
                      </div>
                    )}
                  {!isMembershipCandidatesLoading &&
                    !membershipCandidatesError &&
                    filteredMembershipCandidates.length > 0 && (
                      <div className="sa-membership-user-list" role="listbox" aria-label="Available users">
                        {filteredMembershipCandidates.map((candidate) => {
                          const fullName = [
                            normalizeDisplayText(candidate.first_name),
                            normalizeDisplayText(candidate.last_name),
                          ]
                            .filter(Boolean)
                            .join(" ")
                            .trim();
                          const title = fullName || normalizeDisplayText(candidate.email) || candidate.user_id;
                          const secondary =
                            normalizeDisplayText(candidate.email) ||
                            candidate.user_id;
                          return (
                            <button
                              key={candidate.user_id}
                              type="button"
                              className="sa-membership-user-item"
                              onClick={() => handleCreateMembership(candidate.user_id)}
                            >
                              <span className="sa-membership-user-main">
                                <strong>{title}</strong>
                                <small>{secondary}</small>
                              </span>
                              <span className="badge text-bg-primary">Add</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                </div>
              </div>

              {membershipsQuery.isError && (
                <div className="alert alert-danger" role="alert">
                  {toErrorMessage(membershipsQuery.error, "Unable to load workspace memberships.")}
                </div>
              )}

              <div className="sa-table-wrap mb-0">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Active</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(membershipsQuery.data?.rows ?? []).map((membership) => (
                      <tr key={membership.membership_id}>
                        <td>
                          <div className="d-flex flex-column">
                            <span>{getMembershipDisplayName(membership)}</span>
                            <small className="text-muted">{membership.user_id}</small>
                          </div>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <input
                            className="form-control form-control-sm"
                            value={membershipRoleDrafts[membership.membership_id] ?? membership.role ?? ""}
                            onChange={(event) =>
                              setMembershipRoleDrafts((prev) => ({
                                ...prev,
                                [membership.membership_id]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td>
                          <div className="form-check form-switch mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={membership.is_active}
                              onChange={(event) => toggleMembershipActive(membership, event.target.checked)}
                            />
                          </div>
                        </td>
                        <td>{formatTimestamp(membership.updated_at)}</td>
                        <td>
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-light"
                              onClick={() => saveMembershipRole(membership)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeMembership(membership.membership_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!membershipsQuery.isFetching && (membershipsQuery.data?.rows ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3">
                          No memberships.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="sa-drawer-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={closeMembershipDrawer}>
                Close
              </button>
            </div>
          </aside>
        </>
      )}

      {deletingWorkspace && (
        <div className="sa-dialog-backdrop" onClick={() => setDeletingWorkspace(null)}>
          <div
            className="sa-dialog"
            role="dialog"
            aria-label="Delete workspace"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sa-dialog-header">Delete Workspace</div>
            <div className="sa-dialog-body">
              <p className="mb-3">
                Delete <strong>{deletingWorkspace.workspace_name || deletingWorkspace.workspace_id}</strong>?
                Soft delete is recommended.
              </p>
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={hardDeleteWorkspace}
                  onChange={(event) => setHardDeleteWorkspace(event.target.checked)}
                />
                <span className="form-check-label">Hard delete permanently</span>
              </label>
            </div>
            <div className="sa-dialog-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setDeletingWorkspace(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleDeleteWorkspace}
                disabled={deleteWorkspaceMutation.isPending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
