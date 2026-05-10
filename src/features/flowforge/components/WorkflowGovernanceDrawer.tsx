import { useEffect, useMemo, useState } from "react";

import type {
  FlowForgeRunAsPrincipal,
  FlowForgeWorkflowDefinition,
  FlowForgeWorkflowPermissions,
} from "../model/types";

function principalLabel(principal?: { principal_type?: string | null; principal_id?: string | null } | null): string {
  const type = principal?.principal_type || "not set";
  const id = principal?.principal_id || "not set";
  return `${type.replace(/_/g, " ")} · ${id}`;
}

function permissionEntries(permissions?: FlowForgeWorkflowDefinition["effective_permissions"] | null) {
  return [
    ["View", Boolean(permissions?.can_view)],
    ["Run", Boolean(permissions?.can_run)],
    ["Manage runs", Boolean(permissions?.can_manage_runs)],
    ["Edit", Boolean(permissions?.can_edit)],
    ["Manage", Boolean(permissions?.can_manage)],
    ["Owner", Boolean(permissions?.can_own)],
  ] as const;
}

interface WorkflowGovernanceDrawerProps {
  open: boolean;
  workflow: FlowForgeWorkflowDefinition;
  permissions?: FlowForgeWorkflowPermissions | null;
  principals: FlowForgeRunAsPrincipal[];
  loading?: boolean;
  saving?: boolean;
  canManage: boolean;
  onClose: () => void;
  onUpdateOwner: (ownerUserId: string) => void;
  onUpdateRunAs: (principal: { principal_type: string; principal_id: string }) => void;
}

export default function WorkflowGovernanceDrawer({
  open,
  workflow,
  permissions,
  principals,
  loading,
  saving,
  canManage,
  onClose,
  onUpdateOwner,
  onUpdateRunAs,
}: WorkflowGovernanceDrawerProps) {
  const [ownerUserId, setOwnerUserId] = useState(workflow.owner_user_id ?? "");
  const [runAsValue, setRunAsValue] = useState("");
  const runAsOptions = useMemo(
    () =>
      principals.map((principal) => ({
        value: `${principal.principal_type}:${principal.principal_id}`,
        label: `${principal.display_name} (${principal.principal_type.replace(/_/g, " ")})`,
        principal,
      })),
    [principals],
  );

  useEffect(() => {
    setOwnerUserId(workflow.owner_user_id ?? "");
    const principalType = workflow.run_as_principal?.principal_type ?? "";
    const principalId = workflow.run_as_principal?.principal_id ?? "";
    setRunAsValue(principalType && principalId ? `${principalType}:${principalId}` : "");
  }, [workflow]);

  if (!open) return null;

  const selectedRunAs = runAsOptions.find((option) => option.value === runAsValue)?.principal;
  const lifecycle = workflow.lifecycle || "development";
  const productionRunAsValid =
    lifecycle !== "production" ||
    ["service_principal", "workspace_principal"].includes(String(workflow.run_as_principal?.principal_type || ""));

  return (
    <>
      <button type="button" className="ff-node-config-drawer-backdrop" aria-label="Close workflow settings" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Workflow settings" className="ff-node-config-drawer ff-governance-drawer">
        <header className="ff-node-config-drawer-header">
          <div>
            <div className="ff-eyebrow">Workflow settings</div>
            <h2>{workflow.name}</h2>
          </div>
          <button type="button" className="ff-node-config-drawer-close" aria-label="Close workflow settings" onClick={onClose}>
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="ff-node-config-drawer-body">
          <section className="ff-governance-grid">
            <article className="ff-governance-card">
              <div className="ff-card-heading">
                <span>Lifecycle</span>
                <strong>{lifecycle}</strong>
              </div>
              <p className="ff-muted mb-0">
                {productionRunAsValid
                  ? "Current run-as settings satisfy the lifecycle requirement."
                  : "Production workflows must run as a workspace or service principal before publishing."}
              </p>
            </article>
            <article className="ff-governance-card">
              <div className="ff-card-heading">
                <span>Current run as</span>
                <strong>{principalLabel(workflow.run_as_principal)}</strong>
              </div>
              <p className="ff-muted mb-0">Future workflow runs snapshot this identity into the run record.</p>
            </article>
          </section>

          <section className="ff-side-panel ff-governance-section">
            <div className="ff-card-heading">
              <span>Owner</span>
              <strong>{workflow.owner_user_id || "Not set"}</strong>
            </div>
            <label className="ff-field" htmlFor="ff-workflow-owner-user-id">
              Owner user id
              <input
                id="ff-workflow-owner-user-id"
                className="form-control"
                value={ownerUserId}
                disabled={!canManage || saving}
                onChange={(event) => setOwnerUserId(event.target.value)}
              />
            </label>
            <div className="ff-governance-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!canManage || saving || !ownerUserId.trim() || ownerUserId.trim() === (workflow.owner_user_id ?? "")}
                onClick={() => onUpdateOwner(ownerUserId.trim())}
              >
                Save owner
              </button>
            </div>
          </section>

          <section className="ff-side-panel ff-governance-section">
            <div className="ff-card-heading">
              <span>Run as</span>
              <strong>{selectedRunAs?.display_name ?? principalLabel(workflow.run_as_principal)}</strong>
            </div>
            <label className="ff-field" htmlFor="ff-workflow-run-as-principal">
              Principal
              <select
                id="ff-workflow-run-as-principal"
                aria-label="Principal"
                className="form-select"
                value={runAsValue}
                disabled={!canManage || saving || loading}
                onChange={(event) => setRunAsValue(event.target.value)}
              >
                <option value="">Select run-as principal</option>
                {runAsOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedRunAs ? (
              <p className="ff-muted mb-0">
                {selectedRunAs.production_eligible ? "Eligible for production workflows." : "Development and test workflows only."}
              </p>
            ) : null}
            <div className="ff-governance-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!canManage || saving || !selectedRunAs}
                onClick={() =>
                  selectedRunAs &&
                  onUpdateRunAs({
                    principal_type: selectedRunAs.principal_type,
                    principal_id: selectedRunAs.principal_id,
                  })
                }
              >
                Save run as
              </button>
            </div>
          </section>

          <section className="ff-side-panel ff-governance-section">
            <div className="ff-card-heading">
              <span>Effective permissions</span>
              <strong>{workflow.effective_permissions?.permission || "none"}</strong>
            </div>
            <div className="ff-permission-grid">
              {permissionEntries(workflow.effective_permissions).map(([label, enabled]) => (
                <span key={label} className={`ff-permission-pill ${enabled ? "is-enabled" : "is-disabled"}`}>
                  <i className={`fa ${enabled ? "fa-check" : "fa-minus"}`} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </section>

          <section className="ff-side-panel ff-governance-section">
            <div className="ff-card-heading">
              <span>Access list</span>
              <strong>{permissions?.items.length ?? 0} grants</strong>
            </div>
            {loading ? <p className="ff-muted mb-0">Loading workflow permissions...</p> : null}
            {!loading && !permissions?.items.length ? <p className="ff-muted mb-0">No explicit ACL grants.</p> : null}
            {permissions?.items.length ? (
              <div className="ff-governance-acl-list">
                {permissions.items.map((entry) => (
                  <div key={`${entry.principal_type}:${entry.principal_id}:${entry.permission}`} className="ff-governance-acl-row">
                    <span>{entry.principal_type.replace(/_/g, " ")}</span>
                    <strong>{entry.principal_id}</strong>
                    <em>{entry.permission}</em>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </aside>
    </>
  );
}
