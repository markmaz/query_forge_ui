import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useWorkspaceBindings } from "@/features/system-admin/hooks";
import type { WorkspaceBindingRow } from "@/features/system-admin/types";
import { ROLE_USAGE_COPY } from "../constants";
import {
  useAccessRoles,
  useAccessUser,
  useAssignWorkspaceRole,
  useEffectiveAccessSummary,
  useRevokeWorkspaceRole,
  useWorkspaceRoleAssignments,
} from "../hooks/useAccessControl";
import EffectiveAccessSummary from "./EffectiveAccessSummary";
import "../accessControl.css";

type Props = {
  open: boolean;
  userId: string | null;
  userEmail?: string | null;
  onClose: () => void;
};

function formatUserName(args: {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  fallback?: string | null;
}) {
  const name = `${args.first_name ?? ""} ${args.last_name ?? ""}`.trim();
  if (name) return name;
  if (args.display_name?.trim()) return args.display_name.trim();
  return args.fallback?.trim() || "Selected User";
}

function statusBadgeClass(status?: string | null): string {
  switch (status) {
    case "Active":
      return "bg-success-subtle text-success-emphasis border border-success-subtle";
    case "Invited":
      return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
    default:
      return "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";
  }
}

function groupLabel(category: string): string {
  if (category === "workspace") return "Workspace Roles";
  if (category === "system") return "System Roles";
  return "Feature Roles";
}

function workspaceOptionLabel(workspace: WorkspaceBindingRow, assignedWorkspaceIds: Set<string>) {
  const base = workspace.workspace_name || workspace.workspace_id;
  return assignedWorkspaceIds.has(String(workspace.workspace_id)) ? `${base} · assigned` : base;
}

export default function UserRoleAssignmentDrawer({ open, userId, userEmail, onClose }: Props) {
  const normalizedUserId = userId?.trim() || null;
  const userQuery = useAccessUser(normalizedUserId);
  const rolesQuery = useAccessRoles();
  const workspaceBindingsQuery = useWorkspaceBindings({
    include_inactive: true,
    limit: 5000,
    offset: 0,
  });

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const userProfile = userQuery.data;
  const assignedWorkspaceIds = useMemo(
    () => new Set((userProfile?.workspaces ?? []).map((workspace) => String(workspace.workspace_id))),
    [userProfile?.workspaces],
  );

  const workspaceOptions = workspaceBindingsQuery.data?.rows ?? [];

  useEffect(() => {
    if (!open) return;
    if (!workspaceOptions.length) return;
    if (selectedWorkspaceId && workspaceOptions.some((workspace) => String(workspace.workspace_id) === selectedWorkspaceId)) {
      return;
    }

    const firstAssigned = workspaceOptions.find((workspace) => assignedWorkspaceIds.has(String(workspace.workspace_id)));
    setSelectedWorkspaceId(String(firstAssigned?.workspace_id ?? workspaceOptions[0]?.workspace_id ?? ""));
  }, [assignedWorkspaceIds, open, selectedWorkspaceId, workspaceOptions]);

  const assignmentsQuery = useWorkspaceRoleAssignments(normalizedUserId, selectedWorkspaceId || null);
  const effectiveAccessQuery = useEffectiveAccessSummary(normalizedUserId, selectedWorkspaceId || null);
  const assignMutation = useAssignWorkspaceRole(normalizedUserId, selectedWorkspaceId || null);
  const revokeMutation = useRevokeWorkspaceRole(normalizedUserId, selectedWorkspaceId || null);

  const assignedRoleKeys = useMemo(
    () => new Set((assignmentsQuery.data ?? []).map((assignment) => assignment.role_key)),
    [assignmentsQuery.data],
  );

  const availableRoles = useMemo(
    () =>
      (rolesQuery.data ?? []).filter((role) => !assignedRoleKeys.has(role.role_key)),
    [assignedRoleKeys, rolesQuery.data],
  );

  const groupedRoles = useMemo(() => {
    const groups = new Map<string, typeof availableRoles>();
    availableRoles.forEach((role) => {
      const key = role.category;
      const existing = groups.get(key) ?? [];
      existing.push(role);
      groups.set(key, existing);
    });
    return groups;
  }, [availableRoles]);

  const selectedWorkspace = workspaceOptions.find(
    (workspace) => String(workspace.workspace_id) === selectedWorkspaceId,
  );

  const handleAssignRole = async () => {
    if (!selectedRoleId) return;
    const role = availableRoles.find((entry) => entry.role_id === selectedRoleId || entry.role_key === selectedRoleId);
    if (!role) return;
    try {
      await assignMutation.mutateAsync({ role_id: role.role_id, role_key: role.role_key });
      toast.success(`Assigned ${role.display_name}.`);
      setSelectedRoleId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to assign role.");
    }
  };

  const handleRemoveRole = async (assignmentId: string, displayName: string) => {
    try {
      await revokeMutation.mutateAsync(assignmentId);
      toast.success(`Removed ${displayName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove role.");
    }
  };

  if (!open || !normalizedUserId) return null;

  return (
    <>
      <div className="ac-drawer-backdrop" onClick={onClose} />
      <aside className="ac-drawer" aria-modal="true" role="dialog" aria-labelledby="user-role-drawer-title">
        <div className="ac-drawer-header d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="small text-uppercase ac-muted mb-1">Workspace Role Assignment</div>
            <h4 id="user-role-drawer-title" className="mb-1">
              {formatUserName({
                first_name: userProfile?.first_name,
                last_name: userProfile?.last_name,
                display_name: userProfile?.display_name,
                fallback: userEmail,
              })}
            </h4>
            <div className="d-flex flex-wrap align-items-center gap-2 small">
              <span className="ac-muted">{userProfile?.email ?? userEmail ?? "No email"}</span>
              <span className={`badge ${statusBadgeClass(userProfile?.status)}`}>{userProfile?.status ?? "Unknown"}</span>
            </div>
          </div>
          <button type="button" className="btn-close" aria-label="Close role assignment panel" onClick={onClose} />
        </div>

        <div className="ac-drawer-body">
          <div className="ac-role-grid mb-4">
            <div className="ac-panel">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h6 className="mb-1">Workspace Context</h6>
                  <div className="small ac-muted">Manage direct roles in the context of the selected workspace and its enabled features.</div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold mb-1">Workspace</label>
                <select
                  className="form-select ac-workspace-selector"
                  value={selectedWorkspaceId}
                  onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                >
                  <option value="">Select workspace</option>
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace.workspace_id} value={workspace.workspace_id}>
                      {workspaceOptionLabel(workspace, assignedWorkspaceIds)}
                    </option>
                  ))}
                </select>
                {selectedWorkspace ? (
                  <div className="small ac-muted mt-2">
                    {selectedWorkspace.organization_name ?? "Unassigned organization"}
                    {selectedWorkspace.datasource_name ? ` · ${selectedWorkspace.datasource_name}` : ""}
                  </div>
                ) : null}
              </div>

              <div className="mb-3">
                <div className="small fw-semibold mb-2">Assigned Workspaces</div>
                <div className="ac-chip-list">
                  {assignedWorkspaceIds.size === 0 ? <span className="small ac-muted">No workspace assignments found.</span> : null}
                  {workspaceOptions
                    .filter((workspace) => assignedWorkspaceIds.has(String(workspace.workspace_id)))
                    .map((workspace) => (
                      <span key={workspace.workspace_id} className="ac-feature-chip is-enabled">
                        {workspace.workspace_name}
                      </span>
                    ))}
                </div>
              </div>

              <div className="border-top pt-3 mt-3">
                <div className="d-flex flex-wrap gap-2 align-items-end">
                  <div className="flex-grow-1">
                    <label className="form-label small fw-semibold mb-1">Add Role</label>
                    <select
                      className="form-select ac-role-selector"
                      value={selectedRoleId}
                      onChange={(event) => setSelectedRoleId(event.target.value)}
                      disabled={!selectedWorkspaceId || assignMutation.isPending}
                    >
                      <option value="">Select a role</option>
                      {[...groupedRoles.entries()].map(([category, roles]) => (
                        <optgroup key={category} label={groupLabel(category)}>
                          {roles.map((role) => (
                            <option key={role.role_id || role.role_key} value={role.role_id || role.role_key}>
                              {role.display_name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-dark"
                    disabled={!selectedWorkspaceId || !selectedRoleId || assignMutation.isPending}
                    onClick={handleAssignRole}
                  >
                    {assignMutation.isPending ? "Assigning..." : "Assign Role"}
                  </button>
                </div>
              </div>
            </div>

            <div className="ac-panel">
              <h6 className="mb-1">Direct Roles In Context</h6>
              <div className="small ac-muted mb-3">These direct roles apply to the user, and their effect depends on whether the selected workspace has the related features enabled.</div>
              {assignmentsQuery.isLoading ? <div className="small ac-muted">Loading workspace roles…</div> : null}
              {assignmentsQuery.isError ? (
                <div className="alert alert-danger py-2 mb-0">{assignmentsQuery.error.message}</div>
              ) : null}
              {!assignmentsQuery.isLoading && !assignmentsQuery.isError ? (
                <div className="ac-chip-list">
                  {(assignmentsQuery.data ?? []).length === 0 ? <span className="small ac-muted">No direct roles assigned for this user.</span> : null}
                  {(assignmentsQuery.data ?? []).map((assignment) => (
                    <span key={assignment.assignment_id} className="ac-role-chip" title={ROLE_USAGE_COPY[assignment.role_key] ?? assignment.display_name}>
                      {assignment.display_name}
                      <button
                        type="button"
                        aria-label={`Remove ${assignment.display_name}`}
                        disabled={revokeMutation.isPending}
                        onClick={() => handleRemoveRole(assignment.assignment_id, assignment.display_name)}
                      >
                        <i className="fa fa-times" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="row g-4">
            <div className="col-12">
              <EffectiveAccessSummary
                entries={effectiveAccessQuery.data ?? []}
                isLoading={effectiveAccessQuery.isLoading}
                error={effectiveAccessQuery.isError ? effectiveAccessQuery.error.message : null}
              />
            </div>
          </div>

          <div className="alert mt-4 mb-0 ac-admin-note">
            Roles are managed per workspace in this panel. The only global role is{" "}
            <code className="ac-admin-note-code">super_admin</code>.
          </div>
        </div>

        <div className="ac-drawer-footer d-flex justify-content-between align-items-center gap-3">
          <div className="small ac-muted">
            Selected workspace: <strong>{selectedWorkspace?.workspace_name ?? "None"}</strong>
          </div>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
