import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useCreateOrganization,
  useCreateOrganizationMembership,
  useDeleteOrganization,
  useDeleteOrganizationMembership,
  useOrganizationMemberships,
  useOrganizations,
  useUpdateOrganization,
  useUpdateOrganizationMembership,
} from "@/features/system-admin/hooks";
import type { UserRow } from "@/domain-model/Users";
import type {
  OrganizationInput,
  TenancyId,
  TenancyMembership,
  TenancyOrganization,
} from "@/features/system-admin/types";
import { fetchUsers } from "@/shared/services/users";
import "../systemAdmin.css";

const LIMIT_OPTIONS = [25, 50, 100, 200] as const;

type OrganizationFormState = {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
};

type MembershipFormState = {
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

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createOrganizationFormState(row?: TenancyOrganization | null): OrganizationFormState {
  return {
    name: row?.name ?? "",
    slug: row?.slug ?? "",
    description: row?.description ?? "",
    is_active: row?.is_active ?? true,
  };
}

function OrganizationMembershipChipsCell({ organizationId }: { organizationId: TenancyId }) {
  const previewQuery = useOrganizationMemberships(
    organizationId,
    { include_inactive: true, limit: 6, offset: 0 },
    Boolean(organizationId)
  );

  if (previewQuery.isFetching) {
    return (
      <span className="badge text-bg-light">
        <span className="sa-spinner" /> Loading
      </span>
    );
  }

  if (previewQuery.isError) {
    return <span className="badge text-bg-secondary">Unavailable</span>;
  }

  const memberships = previewQuery.data?.rows ?? [];
  if (memberships.length === 0) {
    return <span className="badge text-bg-light">No members</span>;
  }

  const visible = memberships.slice(0, 2);
  const remaining = memberships.length - visible.length;

  return (
    <div className="sa-membership-chip-list">
      {visible.map((membership) => (
        <span
          key={membership.membership_id}
          className={`badge ${membership.is_active ? "text-bg-primary" : "text-bg-secondary"}`}
          title={membership.user_id}
        >
          {membership.user_id}
        </span>
      ))}
      {remaining > 0 && <span className="badge text-bg-light">+{remaining} more</span>}
    </div>
  );
}

export default function TenancyOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [limit, setLimit] = useState<number>(25);
  const [offset, setOffset] = useState(0);
  const [drawerOrg, setDrawerOrg] = useState<TenancyOrganization | null>(null);
  const [isOrgDrawerOpen, setIsOrgDrawerOpen] = useState(false);
  const [orgForm, setOrgForm] = useState<OrganizationFormState>(createOrganizationFormState());
  const [deletingOrg, setDeletingOrg] = useState<TenancyOrganization | null>(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [membershipForm, setMembershipForm] = useState<MembershipFormState>({
    role: "",
    is_active: true,
  });
  const [membershipRoleDrafts, setMembershipRoleDrafts] = useState<Record<string, string>>({});
  const [membershipSearch, setMembershipSearch] = useState("");
  const [membershipCandidates, setMembershipCandidates] = useState<UserRow[]>([]);
  const [isMembershipCandidatesLoading, setIsMembershipCandidatesLoading] = useState(false);
  const [membershipCandidatesError, setMembershipCandidatesError] = useState<string | null>(null);

  const orgParams = useMemo(
    () => ({
      q: search.trim() || undefined,
      include_inactive: includeInactive,
      limit,
      offset,
    }),
    [includeInactive, limit, offset, search]
  );

  const organizationsQuery = useOrganizations(orgParams);
  const createOrganizationMutation = useCreateOrganization();
  const updateOrganizationMutation = useUpdateOrganization();
  const deleteOrganizationMutation = useDeleteOrganization();

  const membershipsQuery = useOrganizationMemberships(
    drawerOrg?.organization_id ?? null,
    { include_inactive: true, limit: 100, offset: 0 },
    Boolean(drawerOrg) && isOrgDrawerOpen
  );
  const createMembershipMutation = useCreateOrganizationMembership();
  const updateMembershipMutation = useUpdateOrganizationMembership();
  const deleteMembershipMutation = useDeleteOrganizationMembership();

  const rows = organizationsQuery.data?.rows ?? [];
  const total = organizationsQuery.data?.total ?? 0;
  const canGoPrevious = offset > 0;
  const canGoNext = offset + limit < total;
  const membershipUserIdSet = useMemo(
    () => new Set((membershipsQuery.data?.rows ?? []).map((membership) => membership.user_id)),
    [membershipsQuery.data?.rows]
  );
  const filteredMembershipCandidates = useMemo(
    () => membershipCandidates.filter((candidate) => !membershipUserIdSet.has(candidate.user_id)),
    [membershipCandidates, membershipUserIdSet]
  );

  useEffect(() => {
    if (!drawerOrg || !isOrgDrawerOpen) {
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
  }, [drawerOrg, isOrgDrawerOpen, membershipSearch]);

  const openCreateDrawer = () => {
    setDrawerOrg(null);
    setOrgForm(createOrganizationFormState());
    setMembershipForm({ role: "", is_active: true });
    setMembershipRoleDrafts({});
    setMembershipSearch("");
    setIsOrgDrawerOpen(true);
  };

  const openDrawerForOrg = (row: TenancyOrganization) => {
    setDrawerOrg(row);
    setOrgForm(createOrganizationFormState(row));
    setMembershipForm({ role: "", is_active: true });
    setMembershipRoleDrafts({});
    setMembershipSearch("");
    setIsOrgDrawerOpen(true);
  };

  const closeOrgDrawer = () => {
    if (createOrganizationMutation.isPending || updateOrganizationMutation.isPending) return;
    setIsOrgDrawerOpen(false);
  };

  const handleSaveOrganization = () => {
    const name = orgForm.name.trim();
    const slug = orgForm.slug.trim() || slugify(name);
    const payload: OrganizationInput = {
      name,
      slug,
      description: orgForm.description.trim() || null,
      is_active: orgForm.is_active,
    };

    if (!payload.name) {
      toast.error("Organization name is required.");
      return;
    }
    if (!payload.slug) {
      toast.error("Organization slug is required.");
      return;
    }

    if (drawerOrg) {
      updateOrganizationMutation.mutate(
        { organizationId: drawerOrg.organization_id, payload },
        {
          onSuccess: () => {
            toast.success("Organization updated.");
            setDrawerOrg((prev): TenancyOrganization | null =>
              prev
                ? {
                    ...prev,
                    ...payload,
                    slug: payload.slug ?? prev.slug,
                    description: payload.description ?? null,
                  }
                : prev
            );
            setOrgForm((prev) => ({ ...prev, slug: payload.slug ?? prev.slug }));
          },
          onError: (error) => toast.error(toErrorMessage(error, "Unable to update organization.")),
        }
      );
      return;
    }

    createOrganizationMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Organization created.");
        setIsOrgDrawerOpen(false);
      },
      onError: (error) => toast.error(toErrorMessage(error, "Unable to create organization.")),
    });
  };

  const handleDeleteOrganization = () => {
    if (!deletingOrg) return;
    deleteOrganizationMutation.mutate(
      {
        organizationId: deletingOrg.organization_id,
        hard: hardDelete,
      },
      {
        onSuccess: () => {
          toast.success(hardDelete ? "Organization hard deleted." : "Organization deleted.");
          setDeletingOrg(null);
          setHardDelete(false);
          if (drawerOrg?.organization_id === deletingOrg.organization_id) {
            setDrawerOrg(null);
            setIsOrgDrawerOpen(false);
          }
        },
        onError: (error) => toast.error(toErrorMessage(error, "Unable to delete organization.")),
      }
    );
  };

  const handleActiveToggle = (row: TenancyOrganization, nextActive: boolean) => {
    updateOrganizationMutation.mutate(
      {
        organizationId: row.organization_id,
        payload: { is_active: nextActive },
      },
      {
        onSuccess: () => toast.success("Organization status updated."),
        onError: (error) => toast.error(toErrorMessage(error, "Unable to update status.")),
      }
    );
  };

  const handleCreateMembership = (userId: string) => {
    if (!drawerOrg) return;
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return;

    createMembershipMutation.mutate(
      {
        organizationId: drawerOrg.organization_id,
        payload: {
          user_id: normalizedUserId,
          role: membershipForm.role.trim() || null,
          is_active: membershipForm.is_active,
        },
      },
      {
        onSuccess: () => {
          toast.success("Membership added.");
          setMembershipSearch("");
        },
        onError: (error) => toast.error(toErrorMessage(error, "Unable to add membership.")),
      }
    );
  };

  const saveMembershipRole = (membership: TenancyMembership) => {
    if (!drawerOrg) return;
    const nextRole = (membershipRoleDrafts[membership.membership_id] ?? membership.role ?? "").trim();

    updateMembershipMutation.mutate(
      {
        organizationId: drawerOrg.organization_id,
        membershipId: membership.membership_id,
        payload: {
          role: nextRole || null,
        },
      },
      {
        onSuccess: () => toast.success("Membership updated."),
        onError: (error) => toast.error(toErrorMessage(error, "Unable to update membership.")),
      }
    );
  };

  const toggleMembershipActive = (membership: TenancyMembership, nextActive: boolean) => {
    if (!drawerOrg) return;
    updateMembershipMutation.mutate(
      {
        organizationId: drawerOrg.organization_id,
        membershipId: membership.membership_id,
        payload: { is_active: nextActive },
      },
      {
        onSuccess: () => toast.success("Membership status updated."),
        onError: (error) => toast.error(toErrorMessage(error, "Unable to update membership status.")),
      }
    );
  };

  const removeMembership = (membershipId: TenancyId) => {
    if (!drawerOrg) return;
    deleteMembershipMutation.mutate(
      {
        organizationId: drawerOrg.organization_id,
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
          <h1>Organizations</h1>
          <p className="sa-page-subtitle">Manage tenant organizations and memberships.</p>
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={openCreateDrawer}>
          <i className="fa fa-plus" /> New Organization
        </button>
      </div>

      <div className="sa-toolbar">
        <label className="sa-field mb-0">
          <span>Search</span>
          <input
            className="form-control form-control-sm"
            value={search}
            placeholder="Search name or slug"
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
          />
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
          onClick={() => void organizationsQuery.refetch()}
          disabled={organizationsQuery.isFetching}
        >
          <i className="fa fa-refresh" /> Refresh
        </button>
      </div>

      {organizationsQuery.isError && (
        <div className="alert alert-danger" role="alert">
          {toErrorMessage(organizationsQuery.error, "Unable to load organizations.")}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          {total} organizations
        </span>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!canGoPrevious || organizationsQuery.isFetching}
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!canGoNext || organizationsQuery.isFetching}
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
              <th>Name</th>
              <th>Slug</th>
              <th>Memberships</th>
              <th>Active</th>
              <th>Updated</th>
              <th style={{ width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.organization_id} className="sa-row-clickable" onClick={() => openDrawerForOrg(row)}>
                <td>{row.name}</td>
                <td>{row.slug}</td>
                <td style={{ minWidth: 210 }}>
                  <OrganizationMembershipChipsCell organizationId={row.organization_id} />
                </td>
                <td>
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={row.is_active}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => handleActiveToggle(row, event.target.checked)}
                    />
                  </div>
                </td>
                <td>{formatTimestamp(row.updated_at)}</td>
                <td>
                  <div className="d-flex gap-2 justify-content-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      aria-label={`Delete organization ${row.name}`}
                      title={`Delete ${row.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingOrg(row);
                        setHardDelete(false);
                      }}
                    >
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!organizationsQuery.isFetching && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  No organizations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isOrgDrawerOpen && (
        <>
          <div className="sa-drawer-backdrop" onClick={closeOrgDrawer} />
          <aside
            className="sa-drawer"
            role="dialog"
            aria-label={drawerOrg ? `Edit organization ${drawerOrg.name}` : "Create organization"}
          >
            <div className="sa-drawer-header">
              <h2>{drawerOrg ? `Organization • ${drawerOrg.name}` : "Create Organization"}</h2>
              <button
                type="button"
                className="btn btn-sm btn-light"
                aria-label="Close organization drawer"
                onClick={closeOrgDrawer}
              >
                <i className="fa fa-xmark" />
              </button>
            </div>
            <div className="sa-drawer-body">
              <div className="sa-drawer-form-card mb-3">
                <h3 className="sa-drawer-form-card-title">{drawerOrg ? "Edit Organization" : "Organization Details"}</h3>
                <div className="sa-org-drawer-form">
                  <label className="sa-field">
                    <span>Name</span>
                    <input
                      className="form-control"
                      value={orgForm.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        setOrgForm((prev) => ({
                          ...prev,
                          name,
                          slug: drawerOrg ? prev.slug : slugify(name),
                        }));
                      }}
                    />
                  </label>
                  <label className="sa-field">
                    <span>Slug</span>
                    <input
                      className="form-control"
                      value={orgForm.slug}
                      onChange={(event) => setOrgForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
                    />
                  </label>
                  <label className="sa-field">
                    <span>Description</span>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={orgForm.description}
                      onChange={(event) => setOrgForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </label>
                  <label className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={orgForm.is_active}
                      onChange={(event) => setOrgForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                    />
                    <span className="form-check-label">Active</span>
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveOrganization}
                  disabled={createOrganizationMutation.isPending || updateOrganizationMutation.isPending}
                >
                  Save
                </button>
              </div>

              {drawerOrg && (
                <>
                  <div className="sa-drawer-form-card mb-3 sa-org-membership-card">
                    <h3 className="sa-drawer-form-card-title">Add Membership</h3>
                    <div className="sa-org-drawer-form">
                      <label className="sa-field">
                        <span>Default Role (optional)</span>
                        <input
                          className="form-control"
                          placeholder="e.g. viewer"
                          value={membershipForm.role}
                          onChange={(event) => setMembershipForm((prev) => ({ ...prev, role: event.target.value }))}
                        />
                      </label>
                      <label className="form-check mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={membershipForm.is_active}
                          onChange={(event) =>
                            setMembershipForm((prev) => ({ ...prev, is_active: event.target.checked }))
                          }
                        />
                        <span className="form-check-label">Membership active on add</span>
                      </label>
                      <label className="sa-field mb-2">
                        <span>Search users</span>
                        <input
                          className="form-control"
                          placeholder="Search by user id or email"
                          value={membershipSearch}
                          onChange={(event) => setMembershipSearch(event.target.value)}
                        />
                      </label>
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
                      {!isMembershipCandidatesLoading && !membershipCandidatesError && filteredMembershipCandidates.length === 0 && (
                        <div className="text-muted small py-2">
                          {membershipSearch.trim().length > 0 ? "No matching users found." : "No users available to add."}
                        </div>
                      )}
                      {!isMembershipCandidatesLoading && !membershipCandidatesError && filteredMembershipCandidates.length > 0 && (
                        <div className="sa-membership-user-list" role="listbox" aria-label="Available users">
                          {filteredMembershipCandidates.map((candidate) => {
                            const fullName = [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim();
                            const title = fullName || candidate.email || candidate.user_id;
                            return (
                              <button
                                key={candidate.user_id}
                                type="button"
                                className="sa-membership-user-item"
                                onClick={() => handleCreateMembership(candidate.user_id)}
                              >
                                <span className="sa-membership-user-main">
                                  <strong>{title}</strong>
                                  <small>{candidate.user_id}</small>
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
                      {toErrorMessage(membershipsQuery.error, "Unable to load memberships.")}
                    </div>
                  )}

                  <div className="sa-table-wrap mb-0">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>user_id</th>
                          <th>role</th>
                          <th>active</th>
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
                            <td colSpan={4} className="text-center text-muted py-3">
                              No memberships.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {deletingOrg && (
        <div className="sa-dialog-backdrop" onClick={() => setDeletingOrg(null)}>
          <div className="sa-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Delete organization">
            <div className="sa-dialog-header">Delete Organization</div>
            <div className="sa-dialog-body">
              <p className="mb-3">
                Delete <strong>{deletingOrg.name}</strong>? Soft delete is recommended.
              </p>
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={hardDelete}
                  onChange={(event) => setHardDelete(event.target.checked)}
                />
                <span className="form-check-label">Hard delete permanently</span>
              </label>
            </div>
            <div className="sa-dialog-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setDeletingOrg(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleDeleteOrganization}
                disabled={deleteOrganizationMutation.isPending}
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
