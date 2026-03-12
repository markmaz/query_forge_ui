import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useCreateWorkspaceMembership,
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
} from "@/features/system-admin/types";
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
  user_id: string;
  role: string;
  is_active: boolean;
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

export default function TenancyWorkspaceBindingsPage() {
  const [organizationFilter, setOrganizationFilter] = useState<string>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [limit, setLimit] = useState<number>(25);
  const [offset, setOffset] = useState(0);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [bindingForm, setBindingForm] = useState<BindingFormState>(createBindingFormState());
  const [membershipWorkspaceId, setMembershipWorkspaceId] = useState<string | null>(null);
  const [membershipForm, setMembershipForm] = useState<MembershipFormState>({
    user_id: "",
    role: "",
    is_active: true,
  });
  const [membershipRoleDrafts, setMembershipRoleDrafts] = useState<Record<string, string>>({});

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

  const membershipsQuery = useWorkspaceMemberships(
    membershipWorkspaceId,
    { include_inactive: true, limit: 100, offset: 0 },
    Boolean(membershipWorkspaceId)
  );
  const createMembershipMutation = useCreateWorkspaceMembership();
  const updateMembershipMutation = useUpdateWorkspaceMembership();
  const deleteMembershipMutation = useDeleteWorkspaceMembership();

  const rows = bindingsQuery.data?.rows ?? [];
  const total = bindingsQuery.data?.total ?? 0;
  const canGoPrevious = offset > 0;
  const canGoNext = offset + limit < total;

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

  const handleCreateMembership = () => {
    if (!membershipWorkspaceId) return;
    const userId = membershipForm.user_id.trim();
    if (!userId) {
      toast.error("User ID is required.");
      return;
    }

    createMembershipMutation.mutate(
      {
        workspaceId: membershipWorkspaceId,
        payload: {
          user_id: userId,
          role: membershipForm.role.trim() || null,
          is_active: membershipForm.is_active,
        },
      },
      {
        onSuccess: () => {
          toast.success("Membership added.");
          setMembershipForm({ user_id: "", role: "", is_active: true });
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
          <h1>Workspace Bindings</h1>
          <p className="sa-page-subtitle">Workspace-first bridge for organization and datasource assignment.</p>
        </div>
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
              <th>workspace_id</th>
              <th>workspace_name</th>
              <th>organization_name</th>
              <th>datasource_name</th>
              <th>datasource_type</th>
              <th>workspace_is_active</th>
              <th>actions</th>
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
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMembershipWorkspaceId(row.workspace_id);
                    }}
                  >
                    Memberships
                  </button>
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
                              setBindingForm((prev) => ({ ...prev, datasource_id: event.target.value }))
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

                      <div className="col-md-6">
                        <label className="sa-field mb-0">
                          <label>Default Catalog</label>
                          <input
                            className="form-control"
                            value={bindingForm.default_catalog}
                            onChange={(event) =>
                              setBindingForm((prev) => ({ ...prev, default_catalog: event.target.value }))
                            }
                          />
                        </label>
                      </div>

                      <div className="col-md-6">
                        <label className="sa-field mb-0">
                          <label>Default Schema</label>
                          <input
                            className="form-control"
                            value={bindingForm.default_schema}
                            onChange={(event) =>
                              setBindingForm((prev) => ({ ...prev, default_schema: event.target.value }))
                            }
                          />
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

      {membershipWorkspaceId && (
        <div className="sa-dialog-backdrop" onClick={() => setMembershipWorkspaceId(null)}>
          <div
            className="sa-dialog wide"
            role="dialog"
            aria-label="Workspace memberships"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sa-dialog-header">Workspace Memberships ({membershipWorkspaceId})</div>
            <div className="sa-dialog-body">
              <div className="sa-card mb-3">
                <div className="sa-card-title">Add Membership</div>
                <div className="row g-2 mt-1">
                  <div className="col-md-5">
                    <input
                      className="form-control form-control-sm"
                      placeholder="user_id"
                      value={membershipForm.user_id}
                      onChange={(event) => setMembershipForm((prev) => ({ ...prev, user_id: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      className="form-control form-control-sm"
                      placeholder="role"
                      value={membershipForm.role}
                      onChange={(event) => setMembershipForm((prev) => ({ ...prev, role: event.target.value }))}
                    />
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
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleCreateMembership}
                    disabled={createMembershipMutation.isPending}
                  >
                    Add
                  </button>
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
                      <th>user_id</th>
                      <th>role</th>
                      <th>active</th>
                      <th>updated_at</th>
                      <th>actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(membershipsQuery.data?.rows ?? []).map((membership) => (
                      <tr key={membership.membership_id}>
                        <td>{membership.user_id}</td>
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
            <div className="sa-dialog-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setMembershipWorkspaceId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
