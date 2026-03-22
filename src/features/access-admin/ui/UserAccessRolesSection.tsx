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
    baselineRoleNames: string[];
    selectedRoleNames: string[];
    hasChanges: boolean;
  }) => void;
};

type ServiceError = Error & { status?: number; details?: unknown };

const toUniqueRoleNames = (value: string[]) => Array.from(new Set(value.filter(Boolean)));

const sortedNames = (value: string[]) => [...value].sort((a, b) => a.localeCompare(b));

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

  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
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
    setSelectedRoleNames(toUniqueRoleNames(direct.map((role) => role.role_name)));
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
    mutationFn: (roleNames: string[]) => {
      if (!normalizedUserId) {
        throw new Error("User id is required to save direct roles.");
      }
      return replaceUserRoles(normalizedUserId, { role_names: roleNames });
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
    mutationFn: (roleName: string) => {
      if (!normalizedUserId) {
        throw new Error("User id is required to remove direct roles.");
      }
      return removeUserRole(normalizedUserId, roleName);
    },
    onMutate: async (roleName) => {
      setInlineError("");
      await queryClient.cancelQueries({ queryKey: userRolesKey });

      const previous = queryClient.getQueryData<UserRolesResponse>(userRolesKey);
      if (!previous) return { previous };

      queryClient.setQueryData<UserRolesResponse>(userRolesKey, {
        ...previous,
        direct_roles: previous.direct_roles.filter((role) => role.role_name !== roleName),
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
    const initialNames = sortedNames(directRoles.map((role) => role.role_name));
    const nextNames = sortedNames(selectedRoleNames);
    if (initialNames.length !== nextNames.length) return true;
    return initialNames.some((roleName, idx) => roleName !== nextNames[idx]);
  }, [directRoles, selectedRoleNames]);

  const selectedRoleMap = useMemo(() => {
    const map = new Map<string, Role>();
    rolesQ.data?.forEach((role) => map.set(role.role_name, role));
    return map;
  }, [rolesQ.data]);

  const displayedDirectRoles = useMemo(() => {
    if (commitMode !== "deferred") return directRoles;
    return selectedRoleNames.map((roleName) => {
      const matched = selectedRoleMap.get(roleName);
      return {
        role_id: matched?.role_id ?? roleName,
        role_name: matched?.role_name ?? roleName,
      };
    });
  }, [commitMode, directRoles, selectedRoleNames, selectedRoleMap]);

  useEffect(() => {
    if (!onDraftChange) return;
    const baselineRoleNames = toUniqueRoleNames(directRoles.map((role) => role.role_name));
    onDraftChange({
      baselineRoleNames,
      selectedRoleNames: toUniqueRoleNames(selectedRoleNames),
      hasChanges: hasRoleChanges,
    });
  }, [directRoles, hasRoleChanges, onDraftChange, selectedRoleNames]);

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
                            setSelectedRoleNames((prev) => prev.filter((value) => value !== role.role_name));
                            setInlineError("");
                            return;
                          }
                          removeM.mutate(role.role_name);
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
                  value={selectedRoleNames}
                  onChange={(event) => {
                    const names = Array.from(event.target.selectedOptions).map((opt) => opt.value);
                    setSelectedRoleNames(toUniqueRoleNames(names));
                    setInlineError("");
                  }}
                >
                  {(rolesQ.data ?? []).map((role) => (
                    <option key={role.role_name} value={role.role_name}>
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
                      onClick={() => replaceM.mutate(toUniqueRoleNames(selectedRoleNames))}
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
                {selectedRoleNames.length > 0 ? (
                  <div className="col-12">
                    <div className="small text-muted qf-user-role-pending">
                      Pending selection:{" "}
                      {selectedRoleNames
                        .map((roleName) => selectedRoleMap.get(roleName)?.role_name ?? roleName)
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
