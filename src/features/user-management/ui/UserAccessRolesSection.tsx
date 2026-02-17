import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { fetchRoles } from "../../../shared/services/roles";
import { fetchUserRoles, removeUserRole, replaceUserRoles } from "../../../shared/services/users";
import type { Role } from "../../../entities/Role";
import type { UserRolesResponse } from "../../../entities/Users";

type Props = {
  userId: string;
  editable?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
};

type ServiceError = Error & { status?: number; details?: unknown };

const toUniqueRoleIds = (value: string[]) => Array.from(new Set(value.filter(Boolean)));

const sortedIds = (value: string[]) => [...value].sort((a, b) => a.localeCompare(b));

export default function UserAccessRolesSection({
  userId,
  editable = false,
  title = "Access Roles",
  subtitle = "Manage direct roles and inspect effective roles.",
  className = "",
}: Props) {
  const queryClient = useQueryClient();
  const userRolesKey = ["userRoles", userId];
  const roleCatalogKey = ["rolesCatalog"];

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [inlineError, setInlineError] = useState<string>("");

  const rolesQ = useQuery<Role[], Error>({
    queryKey: roleCatalogKey,
    queryFn: fetchRoles,
    staleTime: 60_000,
    enabled: Boolean(userId),
  });

  const userRolesQ = useQuery<UserRolesResponse, ServiceError>({
    queryKey: userRolesKey,
    queryFn: () => fetchUserRoles(userId),
    enabled: Boolean(userId),
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
    mutationFn: (roleIds: string[]) => replaceUserRoles(userId, { role_ids: roleIds }),
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
    mutationFn: (roleId: string) => removeUserRole(userId, roleId),
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

  const roleCatalogError = rolesQ.isError ? rolesQ.error.message : "";
  const userRolesError = userRolesQ.isError ? mapErrorMessage(userRolesQ.error, "user") : "";

  return (
    <div className={`qf-user-access-roles border rounded p-3 mt-4 ${className}`.trim()}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
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
        <div className="alert alert-warning py-2 mb-3" role="alert">
          {roleCatalogError}
        </div>
      ) : null}

      {userRolesError ? (
        <div className="alert alert-danger py-2 mb-3" role="alert">
          {userRolesError}
        </div>
      ) : null}

      {userRolesQ.isLoading ? (
        <div className="text-muted small">Loading roles...</div>
      ) : (
        <>
          <div className="mb-3">
            <div className="fw-semibold small text-uppercase text-muted mb-2">Direct Roles</div>
            <div className="d-flex flex-wrap gap-2">
              {directRoles.length === 0 ? <span className="text-muted small">No direct roles assigned.</span> : null}
              {directRoles.map((role) => (
                <span key={role.role_id} className="badge text-bg-light border d-inline-flex align-items-center gap-1">
                  {role.role_name}
                  {editable ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0 text-danger text-decoration-none"
                      aria-label={`Remove role ${role.role_name}`}
                      disabled={removeM.isPending}
                      onClick={() => removeM.mutate(role.role_id)}
                    >
                      <i className="fa fa-times" />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="fw-semibold small text-uppercase text-muted mb-2">Effective Roles</div>
            <div className="d-flex flex-wrap gap-2">
              {effectiveRoles.length === 0 ? <span className="text-muted small">No effective roles found.</span> : null}
              {effectiveRoles.map((role) => (
                <span key={role.role_id} className="badge text-bg-secondary">
                  {role.role_name}
                </span>
              ))}
            </div>
          </div>

          {editable ? (
            <div className="row g-2 align-items-end">
              <div className="col-md-8">
                <label htmlFor={`role-multi-${userId}`} className="form-label small fw-semibold mb-1">
                  Select Direct Roles
                </label>
                <select
                  id={`role-multi-${userId}`}
                  className="form-select"
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
              <div className="col-md-4 d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary w-100"
                  disabled={!hasRoleChanges || isBusy}
                  onClick={() => replaceM.mutate(toUniqueRoleIds(selectedRoleIds))}
                >
                  {replaceM.isPending ? "Saving..." : "Save Direct Roles"}
                </button>
              </div>
              {selectedRoleIds.length > 0 ? (
                <div className="col-12">
                  <div className="small text-muted">
                    Pending selection:{" "}
                    {selectedRoleIds
                      .map((roleId) => selectedRoleMap.get(roleId)?.role_name ?? roleId)
                      .join(", ")}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="small text-muted">You have read-only access to direct role assignments.</div>
          )}
        </>
      )}
    </div>
  );
}
