import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { MCP_APP_PRINCIPAL_TOOLS } from "../api";
import { useCreateMCPAppPrincipal, useMCPAppPrincipals, useRevokeMCPAppPrincipal } from "../hooks/useAccessControl";
import type { MCPAppPrincipalCreatePayload, MCPAppPrincipalTool } from "../types";
import { useOrganizations, useWorkspaceBindings } from "@/features/system-admin/hooks";
import "@/features/system-admin/ui/systemAdmin.css";
import "../accessControl.css";

type SecretState = {
  clientId: string;
  clientSecret: string;
} | null;

function splitDomainKeys(value: string): string[] {
  return value
    .replace(/\n/g, ",")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function MCPAppPrincipalsPage() {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTools, setSelectedTools] = useState<MCPAppPrincipalTool[]>([]);
  const [domainKeys, setDomainKeys] = useState("");
  const [canPreview, setCanPreview] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(100);
  const [expiresAt, setExpiresAt] = useState("");
  const [createdSecret, setCreatedSecret] = useState<SecretState>(null);
  const [revokeClientId, setRevokeClientId] = useState<string | null>(null);

  const organizationsQuery = useOrganizations({ include_inactive: true, limit: 500, offset: 0 });
  const bindingsQuery = useWorkspaceBindings({
    include_inactive: true,
    organization_id: selectedOrganizationId || undefined,
    limit: 5000,
    offset: 0,
  });

  const workspaceOptions = useMemo(
    () =>
      (bindingsQuery.data?.rows ?? []).filter(
        (row) => !selectedOrganizationId || String(row.organization_id ?? "") === selectedOrganizationId,
      ),
    [bindingsQuery.data?.rows, selectedOrganizationId],
  );

  useEffect(() => {
    if (workspaceOptions.some((workspace) => String(workspace.workspace_id) === selectedWorkspaceId)) return;
    setSelectedWorkspaceId(String(workspaceOptions[0]?.workspace_id ?? ""));
  }, [selectedWorkspaceId, workspaceOptions]);

  const selectedWorkspace = workspaceOptions.find((workspace) => String(workspace.workspace_id) === selectedWorkspaceId) ?? null;
  const principalsQuery = useMCPAppPrincipals(selectedWorkspaceId || null);
  const createPrincipalMutation = useCreateMCPAppPrincipal(selectedWorkspaceId || null);
  const revokePrincipalMutation = useRevokeMCPAppPrincipal(selectedWorkspaceId || null);

  const resetForm = () => {
    setDisplayName("");
    setDescription("");
    setSelectedTools([]);
    setDomainKeys("");
    setCanPreview(false);
    setPreviewLimit(100);
    setExpiresAt("");
  };

  const toggleTool = (tool: MCPAppPrincipalTool) => {
    setSelectedTools((current) =>
      current.includes(tool) ? current.filter((entry) => entry !== tool) : [...current, tool],
    );
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const payload: MCPAppPrincipalCreatePayload = {
      display_name: displayName.trim(),
      description: description.trim() || null,
      allowed_tools: selectedTools,
      allowed_domain_keys: splitDomainKeys(domainKeys),
      can_preview: canPreview,
      preview_row_limit: previewLimit,
      expires_at: expiresAt.trim() || null,
    };
    try {
      const result = await createPrincipalMutation.mutateAsync(payload);
      setCreatedSecret({ clientId: result.item.client_id, clientSecret: result.client_secret });
      resetForm();
      toast.success("MCP app principal created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create MCP app principal.");
    }
  };

  const handleCopySecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(`client_id=${createdSecret.clientId}\nclient_secret=${createdSecret.clientSecret}`);
    toast.success("Client credentials copied.");
  };

  const handleRevoke = async (clientId: string) => {
    setRevokeClientId(clientId);
  };

  const confirmRevoke = async () => {
    if (!revokeClientId) return;
    try {
      await revokePrincipalMutation.mutateAsync(revokeClientId);
      toast.success("MCP app principal revoked.");
      setRevokeClientId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to revoke MCP app principal.");
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>MCP App Principals</h1>
          <p className="sa-page-subtitle">
            Create and revoke server-to-server MCP credentials for a workspace. Human MCP access still uses RBAC roles.
          </p>
        </div>
      </div>

      <div className="ac-toolbar mb-4">
        <label className="sa-field mb-0" style={{ minWidth: 260 }}>
          <span>Organization</span>
          <select className="form-select" value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)}>
            <option value="">All organizations</option>
            {(organizationsQuery.data?.rows ?? []).map((organization) => (
              <option key={organization.organization_id} value={organization.organization_id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

        <label className="sa-field mb-0" style={{ minWidth: 320 }}>
          <span>Workspace</span>
          <select className="form-select" value={selectedWorkspaceId} onChange={(event) => setSelectedWorkspaceId(event.target.value)}>
            <option value="">Select workspace</option>
            {workspaceOptions.map((workspace) => (
              <option key={workspace.workspace_id} value={workspace.workspace_id}>
                {workspace.workspace_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedWorkspace ? (
        <section className="ac-panel ac-workspace-context-card mb-4" aria-labelledby="mcp-selected-workspace-heading">
          <div>
            <h2 id="mcp-selected-workspace-heading" className="h6 mb-1">
              Selected Workspace
            </h2>
            <div className="h5 mb-0">{selectedWorkspace.workspace_name}</div>
          </div>
          <div className="ac-workspace-context-meta">
            <div>
              <div className="small text-uppercase ac-muted">Organization</div>
              <div className="fw-semibold">{selectedWorkspace.organization_name ?? "No organization"}</div>
            </div>
            <div>
              <div className="small text-uppercase ac-muted">Datasource</div>
              <div className="fw-semibold">{selectedWorkspace.datasource_name ?? "No datasource binding"}</div>
            </div>
          </div>
        </section>
      ) : null}

      {createdSecret ? (
        <section className="ac-panel ac-secret-panel mb-4" aria-label="One-time MCP client secret">
          <div>
            <div className="small text-uppercase ac-muted mb-1">One-time credentials</div>
            <h2 className="h5 mb-2">Store this client secret now</h2>
            <p className="mb-3 ac-muted">
              QueryForge stores only the SHA-256 hash. The secret will not be available again after you leave this page.
            </p>
            <code className="ac-secret-block">{`client_id=${createdSecret.clientId}\nclient_secret=${createdSecret.clientSecret}`}</code>
          </div>
          <button type="button" className="btn btn-dark" onClick={handleCopySecret}>
            Copy credentials
          </button>
        </section>
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-xxl-5">
          <form className="ac-panel ac-principal-form" onSubmit={handleCreate}>
            <div>
              <h2 className="h5 mb-1">Create app principal</h2>
              <p className="small ac-muted mb-0">
                Grants are workspace-scoped. Leave tools and domains empty to allow all MCP tools and domains visible to this workspace grant.
              </p>
            </div>

            <label className="sa-field">
              <span>Display name</span>
              <input
                className="form-control"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="District reporting agent"
                required
              />
            </label>

            <label className="sa-field">
              <span>Description</span>
              <textarea
                className="form-control"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="What owns this credential and how it is used"
              />
            </label>

            <div className="sa-field">
              <span>Allowed tools</span>
              <div className="ac-tool-grid">
                {MCP_APP_PRINCIPAL_TOOLS.map((tool) => (
                  <label key={tool.key} className="form-check ac-tool-option">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={selectedTools.includes(tool.key)}
                      onChange={() => toggleTool(tool.key)}
                    />
                    <span className="form-check-label">{tool.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="sa-field">
              <span>Allowed domain keys</span>
              <textarea
                className="form-control"
                value={domainKeys}
                onChange={(event) => setDomainKeys(event.target.value)}
                rows={3}
                placeholder="attendance, students"
              />
            </label>

            <div className="ac-inline-controls">
              <label className="form-check form-switch">
                <input className="form-check-input" type="checkbox" checked={canPreview} onChange={(event) => setCanPreview(event.target.checked)} />
                <span className="form-check-label fw-semibold">Allow preview rows</span>
              </label>

              <label className="sa-field mb-0">
                <span>Preview row limit</span>
                <input
                  className="form-control"
                  type="number"
                  min={1}
                  max={500}
                  value={previewLimit}
                  onChange={(event) => setPreviewLimit(Number(event.target.value))}
                />
              </label>
            </div>

            <label className="sa-field">
              <span>Expiration</span>
              <input className="form-control" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>

            <button type="submit" className="btn btn-primary" disabled={!selectedWorkspaceId || createPrincipalMutation.isPending}>
              {createPrincipalMutation.isPending ? "Creating..." : "Create app principal"}
            </button>
          </form>
        </div>

        <div className="col-12 col-xxl-7">
          <section className="ac-panel">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Workspace app principals</h2>
                <p className="small ac-muted mb-0">Secrets are never displayed after creation. Revoke unused principals immediately.</p>
              </div>
              <span className="ac-status-chip is-empty">{principalsQuery.data?.length ?? 0} principals</span>
            </div>

            {principalsQuery.isLoading ? <div className="ac-empty-state">Loading MCP app principals...</div> : null}
            {principalsQuery.isError ? <div className="alert alert-danger">{principalsQuery.error.message}</div> : null}
            {!principalsQuery.isLoading && !principalsQuery.data?.length ? (
              <div className="ac-empty-state">No MCP app principals have been created for this workspace.</div>
            ) : null}

            <div className="ac-principal-list">
              {(principalsQuery.data ?? []).map((principal) => {
                const isRevoked = Boolean(principal.revoked_at || principal.grant.revoked_at);
                const status = isRevoked ? "Revoked" : principal.grant.enabled ? "Active" : "Disabled";
                const tools = principal.grant.allowed_tools.length ? principal.grant.allowed_tools.join(", ") : "All tools";
                const domains = principal.grant.allowed_domain_keys.length ? principal.grant.allowed_domain_keys.join(", ") : "All domains";
                return (
                  <article key={principal.client_id} className="ac-principal-card">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="small text-uppercase ac-muted mb-1">{principal.client_id}</div>
                        <h3 className="h5 mb-1">{principal.display_name}</h3>
                        <p className="small ac-muted mb-0">{principal.description ?? "No description provided."}</p>
                      </div>
                      <span className={`ac-feature-chip ${isRevoked ? "is-disabled" : "is-enabled"}`}>{status}</span>
                    </div>

                    <div className="ac-principal-meta">
                      <div>
                        <span>Tools</span>
                        <strong>{tools}</strong>
                      </div>
                      <div>
                        <span>Domains</span>
                        <strong>{domains}</strong>
                      </div>
                      <div>
                        <span>Preview</span>
                        <strong>{principal.grant.can_preview ? `Allowed (${principal.grant.preview_row_limit})` : "Blocked"}</strong>
                      </div>
                      <div>
                        <span>Last used</span>
                        <strong>{formatDate(principal.last_used_at)}</strong>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                      <div className="small ac-muted">Expires: {formatDate(principal.expires_at ?? principal.grant.expires_at)}</div>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        disabled={isRevoked || revokePrincipalMutation.isPending}
                        onClick={() => handleRevoke(principal.client_id)}
                      >
                        Revoke
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(revokeClientId)}
        title="Revoke MCP app principal"
        message="Revoke this MCP app principal? Existing short-lived tokens may remain valid until expiry."
        confirmLabel="Revoke principal"
        busy={revokePrincipalMutation.isPending}
        onClose={() => setRevokeClientId(null)}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
