import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { fetchRoles } from "../../../shared/services/roles";
import { fetchUserRoles, removeUserRole, replaceUserRoles } from "../../../shared/services/users";
import type { Role } from "../../../domain-model/Role";
import type { UserRolesResponse } from "../../../domain-model/Users";
import "./UserAccessRolesSection.css";
import "./UserManagementTheme.css";

type Props = {
  userId?: string | null;
  editable?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  commitMode?: "inline" | "deferred";
  onDraftChange?: (draft: {
    baselineRoleIds: string[];
    selectedRoleIds: string[];
    hasChanges: boolean;
  }) => void;
};

type ServiceError = Error & { status?: number; details?: unknown };

const toUniqueRoleIds = (value: string[]) => Array.from(new Set(value.filter(Boolean)));

const sortedIds = (value: string[]) => [...value].sort((a, b) => a.localeCompare(b));

function roleBadgeClass(roleName?: string): string {
  const normalized = (roleName ?? "").trim().toLowerCase();
  switch (normalized) {
    case "admin":
      return "badge qf-um-role-badge qf-um-role-badge-admin";
    case "owner":
      return "badge qf-um-role-badge qf-um-role-badge-owner";
    case "user":
      return "badge qf-um-role-badge qf-um-role-badge-user";
    case "viewer":
    case "read-only":
      return "badge qf-um-role-badge qf-um-role-badge-viewer";
    default:
      return "badge qf-um-role-badge qf-um-role-badge-default";
  }
}

export default function UserAccessRolesSection({
  userId,
  editable = false,
  title = "Access Roles",
  subtitle = "Manage direct roles and inspect effective roles.",
  className = "",
  commitMode = "inline",
  onDraftChange,
}: Props) {
  const queryClient = useQueryClient();
  const normalizedUserId = typeof userId === "string" && userId.trim().length > 0 ? userId.trim() : null;
  const userRolesKey = ["userRoles", normalizedUserId ?? "pending"];
  const roleCatalogKey = ["rolesCatalog"];

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [inlineError, setInlineError] = useState<string>("");

  const rolesQ = useQuery<Role[], Error>({
    queryKey: roleCatalogKey,
    queryFn: fetchRoles,
    staleTime: 60_000,
    enabled: true,
  });

  const userRolesQ = useQuery<UserRolesResponse, ServiceError>({
    queryKey: userRolesKey,
    queryFn: () => fetchUserRoles(normalizedUserId as string),
    enabled: Boolean(normalizedUserId),
    retry: false,
  });

  useEffect(() => {
    const direct = userRolesQ.data?.direct_roles ?? [];
    setSelectedRoleIds(toUniqueRoleIds(direct.map((role) => role.role_id)));
  }, [userRolesQ.data?.direct_roles]);

  const mapErrorMessage = (error: unknown, scope: "user" | "role"): string => {
    const serviceError = error as ServiceError;
    const status = serviceError?.status;
    const message = String(serviceError?.message ?? "Request failed.");

    if (status === 404 && scope === "user") {
      return "User no longer exists.";
    }
    if (status === 404 && scope === "role") {
      void queryClient.invalidateQueries({ queryKey: roleCatalogKey });
      toast.warn("Role not found. Role catalog refreshed.");
      return "Role no longer exists.";
    }
    if (status === 400) {
      return message || "Validation error. Check role payload.";
    }
    return message || "Request failed.";
  };

  const replaceM = useMutation({
    mutationFn: (roleIds: string[]) => {
      if (!normalizedUserId) {
        throw new Error("User id is required to save direct roles.");
      }
      return replaceUserRoles(normalizedUserId, { role_ids: roleIds });
    },
    onSuccess: async (result) => {
      setInlineError("");
      queryClient.setQueryData<UserRolesResponse>(userRolesKey, (previous) => ({
        user_id: result.user_id,
        direct_roles: result.roles,
        effective_roles: previous?.effective_roles ?? result.roles,
      }));
      toast.success("Direct roles updated.");
      await queryClient.invalidateQueries({ queryKey: userRolesKey });
    },
    onError: (error) => {
      setInlineError(mapErrorMessage(error, "role"));
      toast.error("Failed to update direct roles.");
    },
  });

  const removeM = useMutation({
    mutationFn: (roleId: string) => {
      if (!normalizedUserId) {
        throw new Error("User id is required to remove direct roles.");
      }
      return removeUserRole(normalizedUserId, roleId);
    },
    onMutate: async (roleId) => {
      setInlineError("");
      await queryClient.cancelQueries({ queryKey: userRolesKey });

      const previous = queryClient.getQueryData<UserRolesResponse>(userRolesKey);
      if (!previous) return { previous };

      queryClient.setQueryData<UserRolesResponse>(userRolesKey, {
        ...previous,
        direct_roles: previous.direct_roles.filter((role) => role.role_id !== roleId),
      });

      return { previous };
    },
    onError: (error, _roleId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userRolesKey, context.previous);
      }
      setInlineError(mapErrorMessage(error, "role"));
      toast.error("Unable to remove role.");
    },
    onSuccess: () => {
      toast.success("Role removed.");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: userRolesKey });
    },
  });

  const isBusy = replaceM.isPending || removeM.isPending;
  const directRoles = userRolesQ.data?.direct_roles ?? [];
  const effectiveRoles = userRolesQ.data?.effective_roles ?? [];

  const hasRoleChanges = useMemo(() => {
    const initialIds = sortedIds(directRoles.map((role) => role.role_id));
    const nextIds = sortedIds(selectedRoleIds);
    if (initialIds.length !== nextIds.length) return true;
    return initialIds.some((roleId, idx) => roleId !== nextIds[idx]);
  }, [directRoles, selectedRoleIds]);

  const selectedRoleMap = useMemo(() => {
    const map = new Map<string, Role>();
    rolesQ.data?.forEach((role) => map.set(role.role_id, role));
    return map;
  }, [rolesQ.data]);

  const displayedDirectRoles = useMemo(() => {
    if (commitMode !== "deferred") return directRoles;
    return selectedRoleIds.map((roleId) => {
      const matched = selectedRoleMap.get(roleId);
      return {
        role_id: roleId,
        role_name: matched?.role_name ?? roleId,
      };
    });
  }, [commitMode, directRoles, selectedRoleIds, selectedRoleMap]);

  useEffect(() => {
    if (!onDraftChange) return;
    const baselineRoleIds = toUniqueRoleIds(directRoles.map((role) => role.role_id));
    onDraftChange({
      baselineRoleIds,
      selectedRoleIds: toUniqueRoleIds(selectedRoleIds),
      hasChanges: hasRoleChanges,
    });
  }, [directRoles, hasRoleChanges, onDraftChange, selectedRoleIds]);

  const roleCatalogError = rolesQ.isError ? rolesQ.error.message : "";
  const userRolesError = normalizedUserId && userRolesQ.isError ? mapErrorMessage(userRolesQ.error, "user") : "";

  return (
    <div className={`qf-user-access-roles ${className}`.trim()}>
      <div className="qf-user-access-header d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h6 className="mb-1">{title}</h6>
          <div className="text-muted small">{subtitle}</div>
        </div>
      </div>

      {inlineError ? (
        <div className="alert alert-danger py-2 mb-3" role="alert">
          {inlineError}
        </div>
      ) : null}

      {roleCatalogError ? (
        <div className="alert alert-secondary py-2 mb-3" role="alert">
          {roleCatalogError}
        </div>
      ) : null}

      {userRolesError ? (
        <div className="alert alert-danger py-2 mb-3" role="alert">
          {userRolesError}
        </div>
      ) : null}

      {normalizedUserId && userRolesQ.isLoading ? (
        <div className="text-muted small">Loading roles...</div>
      ) : (
        <>
          <div className="qf-user-role-panels mb-3">
            <div className="mb-3 qf-user-role-panel">
              <div className="fw-semibold small text-uppercase text-muted mb-2">Direct Roles</div>
              <div className="qf-role-chip-list">
                {displayedDirectRoles.length === 0 ? <span className="text-muted small">No direct roles assigned.</span> : null}
                {displayedDirectRoles.map((role) => (
                  <span key={role.role_id} className={`${roleBadgeClass(role.role_name)} d-inline-flex align-items-center gap-1`}>
                    {role.role_name}
                    {editable ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-decoration-none qf-user-role-remove-btn"
                        aria-label={`Remove role ${role.role_name}`}
                        disabled={commitMode === "inline" ? removeM.isPending : isBusy}
                        onClick={() => {
                          if (commitMode === "deferred") {
                            setSelectedRoleIds((prev) => prev.filter((roleId) => roleId !== role.role_id));
                            setInlineError("");
                            return;
                          }
                          removeM.mutate(role.role_id);
                        }}
                      >
                        <i className="fa fa-times" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>

            {normalizedUserId ? (
              <div className="mb-3 qf-user-role-panel">
                <div className="fw-semibold small text-uppercase text-muted mb-2">Effective Roles</div>
                <div className="qf-role-chip-list">
                  {effectiveRoles.length === 0 ? <span className="text-muted small">No effective roles found.</span> : null}
                  {effectiveRoles.map((role) => (
                    <span key={role.role_id} className={roleBadgeClass(role.role_name)}>
                      {role.role_name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {editable ? (
            <div className="qf-user-role-editor border-top pt-3 mt-2">
              <div className="row g-3 align-items-start">
                <div className="col-12 col-xl-8">
                <label htmlFor={`role-multi-${userId}`} className="form-label small fw-semibold mb-1">
                  Select Direct Roles
                </label>
                <select
                  id={`role-multi-${userId}`}
                  className="form-select qf-role-multiselect"
                  multiple
                  aria-label="Select direct roles"
                  size={Math.min(8, Math.max(3, (rolesQ.data ?? []).length))}
                  value={selectedRoleIds}
                  onChange={(event) => {
                    const ids = Array.from(event.target.selectedOptions).map((opt) => opt.value);
                    setSelectedRoleIds(toUniqueRoleIds(ids));
                    setInlineError("");
                  }}
                >
                  {(rolesQ.data ?? []).map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
                </div>
                {commitMode === "inline" ? (
                  <div className="col-12 col-xl-4">
                    <button
                      type="button"
                      className="btn btn-primary w-100"
                      disabled={!hasRoleChanges || isBusy}
                      onClick={() => replaceM.mutate(toUniqueRoleIds(selectedRoleIds))}
                    >
                      {replaceM.isPending ? "Saving..." : "Save Direct Roles"}
                    </button>
                  </div>
                ) : (
                  <div className="col-12 col-xl-4 d-flex align-items-start">
                    <div className="small text-muted mt-1">
                      Direct role changes will be saved with <strong>Save Changes</strong>.
                    </div>
                  </div>
                )}
                {selectedRoleIds.length > 0 ? (
                  <div className="col-12">
                    <div className="small text-muted qf-user-role-pending">
                      Pending selection:{" "}
                      {selectedRoleIds
                        .map((roleId) => selectedRoleMap.get(roleId)?.role_name ?? roleId)
                        .join(", ")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="small text-muted">You have read-only access to direct role assignments.</div>
          )}
        </>
      )}
    </div>
  );
}
