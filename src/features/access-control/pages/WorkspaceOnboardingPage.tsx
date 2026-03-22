import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useMutation } from "@tanstack/react-query";
import { routes } from "@/app/navigation/routes";
import { useOrganizations, useWorkspaceBindings } from "@/features/system-admin/hooks";
import { FEATURE_DEFINITIONS, SUPER_USER_ROLE_KEY, WORKSPACE_ADMIN_ROLE_KEY } from "../constants";
import { assignWorkspaceRole } from "../api";
import {
  useAccessUserSearch,
  useUpdateWorkspaceFeature,
  useWorkspaceFeatures,
  useWorkspaceReadiness,
} from "../hooks/useAccessControl";
import WorkspaceReadinessCard from "../components/WorkspaceReadinessCard";
import "@/features/system-admin/ui/systemAdmin.css";
import "../accessControl.css";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: Array<{ id: WizardStep; title: string }> = [
  { id: 1, title: "Workspace" },
  { id: 2, title: "Features" },
  { id: 3, title: "Workspace Admin" },
  { id: 4, title: "Super User" },
  { id: 5, title: "Review" },
  { id: 6, title: "Complete" },
];

function userLabel(user: {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}) {
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name ? `${name} · ${user.email ?? "No email"}` : user.email ?? "Unnamed user";
}

export default function WorkspaceOnboardingPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedFeatureKeys, setSelectedFeatureKeys] = useState<string[]>([]);
  const [workspaceAdminSearch, setWorkspaceAdminSearch] = useState("");
  const [workspaceAdminUserId, setWorkspaceAdminUserId] = useState("");
  const [superUserSearch, setSuperUserSearch] = useState("");
  const [superUserId, setSuperUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

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
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleKey }: { userId: string; roleKey: string }) =>
      assignWorkspaceRole(userId, selectedWorkspaceId, { role_key: roleKey }),
  });
  const adminSearchQuery = useAccessUserSearch(workspaceAdminSearch);
  const superUserSearchQuery = useAccessUserSearch(superUserSearch);

  useEffect(() => {
    if (!featuresQuery.data?.length) return;
    setSelectedFeatureKeys((current) =>
      current.length > 0
        ? current
        : featuresQuery.data.filter((feature) => feature.enabled).map((feature) => feature.feature_key),
    );
  }, [featuresQuery.data]);

  const toggleFeature = (featureKey: string) => {
    setSelectedFeatureKeys((current) =>
      current.includes(featureKey)
        ? current.filter((key) => key !== featureKey)
        : [...current, featureKey],
    );
  };

  const selectedWorkspace = workspaceOptions.find((workspace) => String(workspace.workspace_id) === selectedWorkspaceId) ?? null;
  const selectedAdminUser = adminSearchQuery.data?.find((user) => user.user_id === workspaceAdminUserId) ?? null;
  const selectedSuperUser = superUserSearchQuery.data?.find((user) => user.user_id === superUserId) ?? null;

  const canAdvance =
    (step === 1 && Boolean(selectedWorkspaceId)) ||
    (step === 2 && selectedFeatureKeys.length > 0) ||
    (step === 3 && Boolean(workspaceAdminUserId)) ||
    step === 4 ||
    step === 5 ||
    step === 6;

  const handleSubmit = async () => {
    if (!selectedWorkspaceId || !workspaceAdminUserId) return;
    setSubmitting(true);
    try {
      const currentFeatureKeys = new Set(
        (featuresQuery.data ?? []).filter((feature) => feature.enabled).map((feature) => feature.feature_key),
      );
      const desiredFeatureKeys = new Set(selectedFeatureKeys);

      for (const feature of FEATURE_DEFINITIONS) {
        const currentEnabled = currentFeatureKeys.has(feature.key);
        const desiredEnabled = desiredFeatureKeys.has(feature.key);
        if (currentEnabled === desiredEnabled) continue;
        await updateFeatureMutation.mutateAsync({ featureKey: feature.key, enabled: desiredEnabled });
      }

      await assignRoleMutation.mutateAsync({
        userId: workspaceAdminUserId,
        roleKey: WORKSPACE_ADMIN_ROLE_KEY,
      });

      if (superUserId) {
        await assignRoleMutation.mutateAsync({
          userId: superUserId,
          roleKey: SUPER_USER_ROLE_KEY,
        });
      }

      toast.success("Workspace onboarding saved.");
      setCompleted(true);
      setStep(6);
      await readinessQuery.refetch();
      await featuresQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete workspace onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Workspace Onboarding</h1>
          <p className="sa-page-subtitle">Bootstrap a new workspace with feature entitlements, a workspace admin, and operational readiness.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to={routes.WorkspaceFeaturesView} className="btn btn-outline-secondary">
            Manage Features
          </Link>
        </div>
      </div>

      <div className="ac-stepper mb-4">
        {STEPS.map((item) => (
          <div key={item.id} className={`ac-step ${step === item.id ? "is-active" : ""} ${step > item.id || (completed && item.id === 6) ? "is-complete" : ""}`}>
            <span className="ac-step-index">{step > item.id || (completed && item.id === 6) ? <i className="fa fa-check" /> : item.id}</span>
            <span>{item.title}</span>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="ac-panel">
            {step === 1 ? (
              <div className="d-grid gap-3">
                <div>
                  <h5 className="mb-1">Workspace Context</h5>
                  <div className="small ac-muted">Select the workspace you want to bring into an operational state.</div>
                </div>
                <label className="sa-field mb-0" style={{ maxWidth: 320 }}>
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
                <label className="sa-field mb-0" style={{ maxWidth: 420 }}>
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
                {selectedWorkspace ? (
                  <div className="ac-surface p-3">
                    <div className="fw-semibold">{selectedWorkspace.workspace_name}</div>
                    <div className="small ac-muted">{selectedWorkspace.organization_name ?? "No organization"}</div>
                    <div className="small ac-muted">{selectedWorkspace.datasource_name ?? "No datasource binding"}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <h5 className="mb-1">Enable Features</h5>
                <div className="small ac-muted mb-3">Choose the QueryForge capabilities this workspace should be able to use.</div>
                <div className="ac-feature-grid">
                  {FEATURE_DEFINITIONS.map((feature) => {
                    const selected = selectedFeatureKeys.includes(feature.key);
                    return (
                      <button key={feature.key} type="button" className={`ac-panel text-start ${selected ? "border-warning" : ""}`} onClick={() => toggleFeature(feature.key)}>
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <div className="small text-uppercase ac-muted mb-1">{feature.key}</div>
                            <div className="fw-semibold">{feature.label}</div>
                          </div>
                          <span className={`ac-feature-chip ${selected ? "is-enabled" : "is-disabled"}`}>{selected ? "Selected" : "Not Selected"}</span>
                        </div>
                        <div className="small ac-muted mt-2">{feature.description}</div>
                        <div className="small ac-muted mt-2">{feature.unlocks}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <h5 className="mb-1">Assign Workspace Admin</h5>
                <div className="small ac-muted mb-3">Pick the primary admin who will manage access and features for this workspace.</div>
                <input className="form-control mb-3" placeholder="Search users by email" value={workspaceAdminSearch} onChange={(event) => setWorkspaceAdminSearch(event.target.value)} />
                <div className="ac-search-results">
                  {(adminSearchQuery.data ?? []).map((user) => (
                    <button
                      key={user.user_id}
                      type="button"
                      className="ac-search-result text-start w-100 border-0"
                      onClick={() => setWorkspaceAdminUserId(user.user_id)}
                    >
                      <span>{userLabel(user)}</span>
                      {workspaceAdminUserId === user.user_id ? <span className="ac-feature-chip is-enabled">Selected</span> : null}
                    </button>
                  ))}
                  {workspaceAdminSearch.trim().length >= 2 && (adminSearchQuery.data ?? []).length === 0 && !adminSearchQuery.isLoading ? (
                    <div className="p-3 small ac-muted">No users found.</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div>
                <h5 className="mb-1">Bootstrap Super User</h5>
                <div className="small ac-muted mb-3">Optional. Use this only if you need an initial elevated admin for system-wide setup.</div>
                <input className="form-control mb-3" placeholder="Search users by email" value={superUserSearch} onChange={(event) => setSuperUserSearch(event.target.value)} />
                <div className="ac-search-results">
                  {(superUserSearchQuery.data ?? []).map((user) => (
                    <button
                      key={user.user_id}
                      type="button"
                      className="ac-search-result text-start w-100 border-0"
                      onClick={() => setSuperUserId(user.user_id)}
                    >
                      <span>{userLabel(user)}</span>
                      {superUserId === user.user_id ? <span className="ac-feature-chip is-enabled">Selected</span> : null}
                    </button>
                  ))}
                  {superUserSearch.trim().length >= 2 && (superUserSearchQuery.data ?? []).length === 0 && !superUserSearchQuery.isLoading ? (
                    <div className="p-3 small ac-muted">No users found.</div>
                  ) : null}
                </div>
                <button type="button" className="btn btn-link px-0 mt-2" onClick={() => setSuperUserId("")}>Skip for now</button>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="d-grid gap-3">
                <div>
                  <h5 className="mb-1">Review</h5>
                  <div className="small ac-muted">Confirm the workspace, enabled features, and admin selections before saving.</div>
                </div>
                <div className="ac-surface p-3">
                  <div className="small text-uppercase ac-muted">Workspace</div>
                  <div className="fw-semibold">{selectedWorkspace?.workspace_name ?? "None selected"}</div>
                </div>
                <div className="ac-surface p-3">
                  <div className="small text-uppercase ac-muted">Features</div>
                  <div className="ac-chip-list mt-2">
                    {selectedFeatureKeys.map((featureKey) => (
                      <span key={featureKey} className="ac-feature-chip is-enabled">
                        {FEATURE_DEFINITIONS.find((feature) => feature.key === featureKey)?.label ?? featureKey}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ac-surface p-3">
                  <div className="small text-uppercase ac-muted">Workspace Admin</div>
                  <div className="fw-semibold">{selectedAdminUser ? userLabel(selectedAdminUser) : "Not selected"}</div>
                </div>
                <div className="ac-surface p-3">
                  <div className="small text-uppercase ac-muted">Super User</div>
                  <div className="fw-semibold">{selectedSuperUser ? userLabel(selectedSuperUser) : "Skipped"}</div>
                </div>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="d-grid gap-3">
                <div>
                  <h5 className="mb-1">Setup Complete</h5>
                  <div className="small ac-muted">The workspace now has an initial feature and admin baseline.</div>
                </div>
                <div className="ac-chip-list">
                  <Link to={routes.UsermanagementView} className="btn btn-dark">Manage Roles</Link>
                  <Link to={routes.WorkspaceFeaturesView} className="btn btn-outline-secondary">Manage Features</Link>
                  <Link to={routes.NoCodeQueryBuilder} className="btn btn-outline-secondary">Open Query Studio</Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="d-flex justify-content-between mt-4 gap-2">
            <button type="button" className="btn btn-outline-secondary" disabled={step === 1 || submitting} onClick={() => setStep((current) => Math.max(1, current - 1) as WizardStep)}>
              Back
            </button>
            <div className="d-flex gap-2">
              {step < 5 ? (
                <button type="button" className="btn btn-dark" disabled={!canAdvance} onClick={() => setStep((current) => Math.min(5, current + 1) as WizardStep)}>
                  Next
                </button>
              ) : null}
              {step === 5 ? (
                <button type="button" className="btn btn-dark" disabled={submitting || !workspaceAdminUserId || !selectedWorkspaceId} onClick={handleSubmit}>
                  {submitting ? "Saving..." : "Complete Setup"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
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
