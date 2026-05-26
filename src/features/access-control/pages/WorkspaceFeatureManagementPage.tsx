import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { routes } from "@/app/navigation/routes";
import { FEATURE_DEFINITIONS } from "../constants";
import { useUpdateWorkspaceFeature, useWorkspaceFeatures, useWorkspaceReadiness } from "../hooks/useAccessControl";
import WorkspaceReadinessCard from "../components/WorkspaceReadinessCard";
import { useOrganizations, useWorkspaceBindings } from "@/features/system-admin/hooks";
import { useIsStrictSystemAdmin } from "@/shared/security/systemAdminAccess";
import "@/features/system-admin/ui/systemAdmin.css";
import "../accessControl.css";

export default function WorkspaceFeatureManagementPage() {
  const systemAdminUser = useIsStrictSystemAdmin();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [searchText, setSearchText] = useState("");

  const organizationsQuery = useOrganizations({ include_inactive: true, limit: 500, offset: 0 });
  const bindingsQuery = useWorkspaceBindings({
    include_inactive: true,
    organization_id: selectedOrganizationId || undefined,
    limit: 5000,
    offset: 0,
  });

  const workspaceOptions = useMemo(
    () => (bindingsQuery.data?.rows ?? []).filter((row) => !selectedOrganizationId || String(row.organization_id ?? "") === selectedOrganizationId),
    [bindingsQuery.data?.rows, selectedOrganizationId],
  );

  useEffect(() => {
    if (workspaceOptions.some((workspace) => String(workspace.workspace_id) === selectedWorkspaceId)) return;
    setSelectedWorkspaceId(String(workspaceOptions[0]?.workspace_id ?? ""));
  }, [selectedWorkspaceId, workspaceOptions]);

  const featuresQuery = useWorkspaceFeatures(selectedWorkspaceId || null);
  const readinessQuery = useWorkspaceReadiness(selectedWorkspaceId || null);
  const updateFeatureMutation = useUpdateWorkspaceFeature(selectedWorkspaceId || null);

  const filteredFeatures = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const entitlements = new Map((featuresQuery.data ?? []).map((entry) => [entry.feature_key, entry]));
    return FEATURE_DEFINITIONS.filter((feature) => {
      if (!q) return true;
      return (
        feature.label.toLowerCase().includes(q) ||
        feature.key.toLowerCase().includes(q) ||
        feature.description.toLowerCase().includes(q)
      );
    }).map((feature) => ({ feature, entitlement: entitlements.get(feature.key) }));
  }, [featuresQuery.data, searchText]);

  const selectedWorkspace = workspaceOptions.find((workspace) => String(workspace.workspace_id) === selectedWorkspaceId) ?? null;

  const handleToggle = async (featureKey: (typeof FEATURE_DEFINITIONS)[number]["key"], nextEnabled: boolean) => {
    try {
      await updateFeatureMutation.mutateAsync({ featureKey, enabled: nextEnabled });
      toast.success(`${nextEnabled ? "Enabled" : "Disabled"} ${FEATURE_DEFINITIONS.find((feature) => feature.key === featureKey)?.label ?? featureKey}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update workspace feature.");
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Workspace Features</h1>
          <p className="sa-page-subtitle">Enable or disable QueryForge capabilities by workspace.</p>
        </div>
        {systemAdminUser ? (
          <div className="d-flex gap-2 flex-wrap">
            <Link to={routes.AdminWorkspaceOnboarding} className="btn btn-outline-secondary">
              Open Onboarding
            </Link>
          </div>
        ) : null}
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

        <label className="sa-field mb-0" style={{ minWidth: 240 }}>
          <span>Search features</span>
          <input className="form-control" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search by name or key" />
        </label>
      </div>

      {selectedWorkspace ? (
        <section className="ac-panel ac-workspace-context-card mb-4" aria-labelledby="selected-workspace-heading">
          <div>
            <h2 id="selected-workspace-heading" className="h6 mb-1">
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

      <div className="row g-4">
        <div className="col-12 col-xxl-8">
          <div className="ac-feature-grid">
            {filteredFeatures.map(({ feature, entitlement }) => {
              const isSaving = updateFeatureMutation.isPending && updateFeatureMutation.variables?.featureKey === feature.key;
              const enabled = entitlement?.enabled ?? false;
              return (
                <div key={feature.key} className="ac-panel ac-feature-card">
                  <div className="d-flex justify-content-between align-items-start gap-3">
                    <div>
                      <div className="small text-uppercase ac-muted mb-1">{feature.key}</div>
                      <h5 className="mb-1">{feature.label}</h5>
                      <div className="small ac-muted">{feature.description}</div>
                    </div>
                    <div className={`ac-feature-chip ${enabled ? "is-enabled" : "is-disabled"}`}>
                      {enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>

                  <div className="small ac-muted">{feature.unlocks}</div>

                  <div className="form-check form-switch mt-auto">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id={`feature-${feature.key}`}
                      checked={enabled}
                      disabled={!selectedWorkspaceId || isSaving}
                      onChange={(event) => handleToggle(feature.key, event.target.checked)}
                    />
                    <label className="form-check-label fw-semibold" htmlFor={`feature-${feature.key}`}>
                      {isSaving ? "Saving..." : enabled ? "Disable feature" : "Enable feature"}
                    </label>
                  </div>
                </div>
              );
            })}
            {!filteredFeatures.length ? <div className="ac-empty-state">No features match the current filter.</div> : null}
          </div>
        </div>

        <div className="col-12 col-xxl-4">
          <WorkspaceReadinessCard
            readiness={readinessQuery.data ?? null}
            isLoading={readinessQuery.isLoading}
            error={readinessQuery.isError ? readinessQuery.error.message : null}
          />
        </div>
      </div>
    </div>
  );
}
