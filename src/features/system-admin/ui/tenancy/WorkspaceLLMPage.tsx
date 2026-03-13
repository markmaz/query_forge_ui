import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useCreateWorkspaceLLM,
  useDeleteWorkspaceLLM,
  useLLMProviders,
  useLLMRoles,
  useOrganizations,
  useTestWorkspaceLLM,
  useUpdateWorkspaceLLM,
  useWorkspaceBindings,
  useWorkspaceLLMs,
} from "@/features/system-admin/hooks";
import type {
  LLMProvider,
  LLMRole,
  WorkspaceBindingRow,
  WorkspaceLLM,
  WorkspaceLLMCreateRequest,
} from "@/features/system-admin/types";
import "../systemAdmin.css";

const ENDPOINT_PROVIDERS: LLMProvider[] = ["azure_openai", "ollama", "generic"];

const ROLE_USAGE_TEXT: Record<LLMRole, string> = {
  planner:
    "Used by planning flows (plan_domain, compact planner, planner_llm, semantic plan).",
  summarizer:
    "Used by planner next-actions and summary-style planner outputs.",
  ner:
    "Used by Forge Insights route classification (education pipeline vs chat).",
  enrichment:
    "Used by ForgeMatch ranking, semantic enrichment/catalog build, domain profile embedding generation, and semantic suggestion labeling.",
  query_generator:
    "Reserved role for query generation-specific flows.",
};

type ActiveFilter = "all" | "active" | "inactive";

type FormState = {
  name: string;
  provider: LLMProvider;
  model_name: string;
  role: LLMRole;
  api_key: string;
  endpoint_url: string;
  is_active: boolean;
  config_json_text: string;
};

function createEmptyForm(): FormState {
  return {
    name: "",
    provider: "openai",
    model_name: "",
    role: "planner",
    api_key: "",
    endpoint_url: "",
    is_active: true,
    config_json_text: "",
  };
}

function parseConfigJson(text: string): {
  value: Record<string, unknown> | null;
  error: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { value: null, error: null };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return { value: parsed, error: null };
  } catch {
    return { value: null, error: "config_json must be valid JSON." };
  }
}

function toFriendlyDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

function buildPayload(form: FormState, isEdit: boolean): WorkspaceLLMCreateRequest {
  const parsedConfig = parseConfigJson(form.config_json_text);
  const payload: WorkspaceLLMCreateRequest = {
    name: form.name.trim(),
    provider: form.provider,
    model_name: form.model_name.trim(),
    role: form.role,
    endpoint_url: form.endpoint_url.trim() || null,
    is_active: form.is_active,
    config_json: parsedConfig.value,
  };

  const apiKey = form.api_key.trim();
  if (apiKey) {
    payload.api_key = apiKey;
  } else if (!isEdit) {
    payload.api_key = undefined;
  }

  return payload;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

type TestResultById = Record<
  number,
  { success: boolean; message: string; diagnostics?: Record<string, unknown> | null }
>;

export default function WorkspaceLLMPage() {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");

  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState<LLMRole | "all">("all");
  const [providerFilter, setProviderFilter] = useState<LLMProvider | "all">("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [selectedRoleUsage, setSelectedRoleUsage] = useState<LLMRole | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editingLLM, setEditingLLM] = useState<WorkspaceLLM | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [testResultById, setTestResultById] = useState<TestResultById>({});

  const organizationsQuery = useOrganizations({
    include_inactive: true,
    limit: 500,
    offset: 0,
  });
  const workspaceBindingsQuery = useWorkspaceBindings({
    include_inactive: true,
    organization_id: selectedOrganizationId || undefined,
    limit: 5000,
    offset: 0,
  });

  const workspaceOptions = useMemo<WorkspaceBindingRow[]>(
    () =>
      (workspaceBindingsQuery.data?.rows ?? []).filter(
        (binding) =>
          selectedOrganizationId &&
          String(binding.organization_id ?? "") === selectedOrganizationId,
      ),
    [workspaceBindingsQuery.data?.rows, selectedOrganizationId],
  );

  const selectedWorkspace = useMemo(
    () =>
      workspaceOptions.find(
        (binding) => String(binding.workspace_id) === selectedWorkspaceId,
      ) ?? null,
    [workspaceOptions, selectedWorkspaceId],
  );

  const wsId = selectedWorkspaceId.trim() || null;
  const rolesQuery = useLLMRoles();
  const providersQuery = useLLMProviders();
  const llmsQuery = useWorkspaceLLMs(wsId);
  const createMutation = useCreateWorkspaceLLM(wsId ?? "");
  const updateMutation = useUpdateWorkspaceLLM(wsId ?? "");
  const deleteMutation = useDeleteWorkspaceLLM(wsId ?? "");
  const testMutation = useTestWorkspaceLLM(wsId ?? "");

  useEffect(() => {
    setDeleteConfirmId(null);
    setTestResultById({});
    setSelectedRowId(null);
    setSelectedRoleUsage(null);
    setShowEditor(false);
    setSaveError(null);
  }, [wsId]);

  useEffect(() => {
    setSelectedWorkspaceId((previous) =>
      workspaceOptions.some(
        (binding) => String(binding.workspace_id) === previous,
      )
        ? previous
        : "",
    );
  }, [workspaceOptions]);

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const rows = llmsQuery.data ?? [];

    return rows
      .filter((row) => {
        if (roleFilter !== "all" && row.role !== roleFilter) return false;
        if (providerFilter !== "all" && row.provider !== providerFilter) return false;
        if (activeFilter === "active" && !row.is_active) return false;
        if (activeFilter === "inactive" && row.is_active) return false;
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.model_name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aTime = Date.parse(a.updated_at ?? "");
        const bTime = Date.parse(b.updated_at ?? "");
        if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
        return b.id - a.id;
      });
  }, [activeFilter, llmsQuery.data, providerFilter, roleFilter, searchText]);

  const configJsonError = useMemo(
    () => parseConfigJson(form.config_json_text).error,
    [form.config_json_text],
  );

  const editorNeedsEndpoint = ENDPOINT_PROVIDERS.includes(form.provider);
  const canSave =
    form.name.trim().length > 0 &&
    form.model_name.trim().length > 0 &&
    (!editorNeedsEndpoint || form.endpoint_url.trim().length > 0) &&
    !configJsonError;

  const openCreate = () => {
    setEditingLLM(null);
    setForm(createEmptyForm());
    setSaveError(null);
    setShowEditor(true);
  };

  const openEdit = (llm: WorkspaceLLM) => {
    setEditingLLM(llm);
    setForm({
      name: llm.name,
      provider: llm.provider,
      model_name: llm.model_name,
      role: llm.role,
      api_key: "",
      endpoint_url: llm.endpoint_url ?? "",
      is_active: llm.is_active,
      config_json_text: llm.config_json
        ? JSON.stringify(llm.config_json, null, 2)
        : "",
    });
    setSaveError(null);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!wsId) return;
    if (!canSave) return;

    const payload = buildPayload(form, Boolean(editingLLM));
    setSaveError(null);

    try {
      if (editingLLM) {
        await updateMutation.mutateAsync({
          llmId: editingLLM.id,
          payload,
        });
        toast.success("LLM configuration updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("LLM configuration created.");
      }
      closeEditor();
    } catch (error) {
      const baseMessage = errorMessage(error, "Unable to save LLM configuration.");
      const conflictHint =
        baseMessage.toLowerCase().includes("active") &&
        baseMessage.toLowerCase().includes("role")
          ? "Only one active LLM is allowed per role in a workspace."
          : null;
      setSaveError(conflictHint ? `${baseMessage} ${conflictHint}` : baseMessage);
    }
  };

  const handleDelete = async (llmId: number) => {
    if (!wsId) return;
    try {
      await deleteMutation.mutateAsync(llmId);
      setDeleteConfirmId(null);
      toast.success("LLM configuration deleted.");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete LLM configuration."));
    }
  };

  const handleTest = async (llm: WorkspaceLLM) => {
    if (!wsId) return;
    try {
      const result = await testMutation.mutateAsync(llm.id);
      setTestResultById((previous) => ({
        ...previous,
        [llm.id]: {
          success: Boolean(result.success),
          message: result.message || (result.success ? "Connection successful." : "Connection failed."),
          diagnostics: result.diagnostics ?? result.details ?? null,
        },
      }));
    } catch (error) {
      setTestResultById((previous) => ({
        ...previous,
        [llm.id]: {
          success: false,
          message: errorMessage(error, "Connection test failed."),
        },
      }));
    }
  };

  const roleUsageEntries = useMemo(
    () =>
      (Object.entries(ROLE_USAGE_TEXT) as Array<[LLMRole, string]>).map(
        ([role, usage]) => ({ role, usage }),
      ),
    [],
  );

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Workspace LLM Configuration</h1>
          <p className="sa-page-subtitle">
            Manage multiple LLM configurations per workspace and role.
          </p>
        </div>
      </div>

      <div className="sa-card mb-3">
        <div className="sa-card-title mb-3">Workspace Selector</div>
        {organizationsQuery.isError || workspaceBindingsQuery.isError ? (
          <div className="alert alert-danger mb-0" role="alert">
            Unable to load organizations and workspaces.
          </div>
        ) : (
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label htmlFor="org-selector" className="form-label">
                Organization
              </label>
              <select
                id="org-selector"
                className="form-select"
                aria-label="Organization"
                value={selectedOrganizationId}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
                disabled={organizationsQuery.isLoading}
              >
                <option value="">Select organization</option>
                {(organizationsQuery.data?.rows ?? []).map((org) => (
                  <option key={org.organization_id} value={org.organization_id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-7">
              <label htmlFor="workspace-selector" className="form-label">
                Workspace
              </label>
              <select
                id="workspace-selector"
                className="form-select"
                aria-label="Workspace"
                value={selectedWorkspaceId}
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                disabled={
                  workspaceBindingsQuery.isLoading || !selectedOrganizationId
                }
              >
                <option value="">
                  {selectedOrganizationId
                    ? "Select workspace"
                    : "Select organization first"}
                </option>
                {workspaceOptions.map((workspace) => (
                  <option key={workspace.workspace_id} value={workspace.workspace_id}>
                    {workspace.workspace_name}
                  </option>
                ))}
              </select>
            </div>
            {selectedWorkspace ? (
              <div className="col-12">
                <div className="small text-muted">
                  Managing <strong>{selectedWorkspace.workspace_name}</strong> (
                  {selectedWorkspace.workspace_id}) in{" "}
                  {selectedWorkspace.organization_name ?? selectedOrganizationId}.
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {wsId ? (
        <>
          <div className="sa-card mb-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="sa-card-title mb-0">Workspace LLMs</div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openCreate}
                disabled={!wsId}
              >
                + Add LLM
              </button>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <label className="form-label" htmlFor="llm-search">
                  Search
                </label>
                <input
                  id="llm-search"
                  className="form-control"
                  placeholder="Search by name or model"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="llm-role-filter">
                  Role
                </label>
                <select
                  id="llm-role-filter"
                  className="form-select"
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(event.target.value as LLMRole | "all")
                  }
                >
                  <option value="all">All roles</option>
                  {(rolesQuery.data ?? []).map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="llm-provider-filter">
                  Provider
                </label>
                <select
                  id="llm-provider-filter"
                  className="form-select"
                  value={providerFilter}
                  onChange={(event) =>
                    setProviderFilter(event.target.value as LLMProvider | "all")
                  }
                >
                  <option value="all">All providers</option>
                  {(providersQuery.data ?? []).map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="llm-active-filter">
                  Status
                </label>
                <select
                  id="llm-active-filter"
                  className="form-select"
                  value={activeFilter}
                  onChange={(event) =>
                    setActiveFilter(event.target.value as ActiveFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {llmsQuery.isLoading ? (
              <div className="text-muted">Loading LLM configurations...</div>
            ) : null}
            {llmsQuery.isError ? (
              <div className="alert alert-danger" role="alert">
                {errorMessage(llmsQuery.error, "Failed to load LLM configurations.")}
              </div>
            ) : null}
            {!llmsQuery.isLoading && !llmsQuery.isError && filteredRows.length === 0 ? (
              <div className="text-muted py-3 text-center">
                No LLM configurations match your filters.
              </div>
            ) : null}

            {filteredRows.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle" aria-label="Workspace LLM table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Provider</th>
                      <th scope="col">Model</th>
                      <th scope="col">Endpoint</th>
                      <th scope="col">Active</th>
                      <th scope="col">Last Updated</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((llm) => {
                      const result = testResultById[llm.id];
                      return (
                        <tr
                          key={llm.id}
                          className={selectedRowId === llm.id ? "table-primary" : undefined}
                          onClick={() => {
                            setSelectedRowId(llm.id);
                            setSelectedRoleUsage(llm.role);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{llm.name}</td>
                          <td>
                            <span
                              className="badge bg-secondary"
                              title={ROLE_USAGE_TEXT[llm.role]}
                              aria-label={`${llm.role} role usage`}
                            >
                              {llm.role}
                            </span>
                          </td>
                          <td>{llm.provider}</td>
                          <td>
                            <code>{llm.model_name}</code>
                          </td>
                          <td className="small text-muted">{llm.endpoint_url || "—"}</td>
                          <td>
                            <span
                              className={`badge ${llm.is_active ? "bg-success" : "bg-secondary"}`}
                            >
                              {llm.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="small text-muted">
                            {toFriendlyDateTime(llm.updated_at)}
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            <div className="d-flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => void handleTest(llm)}
                                disabled={testMutation.isPending}
                              >
                                Test
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => openEdit(llm)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => setDeleteConfirmId(llm.id)}
                              >
                                Delete
                              </button>
                            </div>

                            {result ? (
                              <div
                                className={`mt-1 small ${result.success ? "text-success" : "text-danger"}`}
                                role="status"
                              >
                                {result.success ? "✓" : "✗"} {result.message}
                                {result.diagnostics ? (
                                  <details className="mt-1">
                                    <summary>Diagnostics</summary>
                                    <pre className="sa-json-preview mb-0">
                                      {JSON.stringify(result.diagnostics, null, 2)}
                                    </pre>
                                  </details>
                                ) : null}
                              </div>
                            ) : null}

                            {deleteConfirmId === llm.id ? (
                              <div className="mt-1 d-flex gap-1 align-items-center">
                                <span className="small text-danger">Confirm delete?</span>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => void handleDelete(llm.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-light btn-sm"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  No
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="sa-card mb-3">
            <div className="sa-card-title mb-2">Where this role is used</div>
            <div className="list-group list-group-flush border rounded">
              {roleUsageEntries.map((entry) => {
                const isSelected = selectedRoleUsage === entry.role;
                return (
                  <button
                    key={entry.role}
                    type="button"
                    className={`list-group-item list-group-item-action ${isSelected ? "active" : ""}`}
                    onClick={() => setSelectedRoleUsage(entry.role)}
                  >
                    <div className="fw-semibold">{entry.role}</div>
                    <div className={`small ${isSelected ? "text-white" : "text-muted"}`}>
                      {entry.usage}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : selectedOrganizationId && !workspaceBindingsQuery.isLoading ? (
        <div className="sa-card">
          <div className="text-muted">
            Select a workspace to manage LLM assignments.
          </div>
        </div>
      ) : null}

      {showEditor ? (
        <div className="sa-dialog-backdrop" role="presentation">
          <div
            className="sa-dialog wide"
            role="dialog"
            aria-modal="true"
            aria-label={
              editingLLM
                ? `Edit ${editingLLM.name}`
                : "Create LLM configuration"
            }
          >
            <div className="sa-dialog-header">
              <span>{editingLLM ? `Edit ${editingLLM.name}` : "Create LLM Configuration"}</span>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={closeEditor}
              >
                Close
              </button>
            </div>

            <div className="sa-dialog-body">
              {saveError ? (
                <div className="alert alert-danger" role="alert">
                  {saveError}
                </div>
              ) : null}

              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="llm-name" className="form-label">
                    Name *
                  </label>
                  <input
                    id="llm-name"
                    className="form-control"
                    value={form.name}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label htmlFor="llm-role" className="form-label">
                    Role *
                  </label>
                  <select
                    id="llm-role"
                    className="form-select"
                    value={form.role}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        role: event.target.value as LLMRole,
                      }))
                    }
                  >
                    {(rolesQuery.data ?? []).map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label htmlFor="llm-provider" className="form-label">
                    Provider *
                  </label>
                  <select
                    id="llm-provider"
                    className="form-select"
                    value={form.provider}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        provider: event.target.value as LLMProvider,
                      }))
                    }
                  >
                    {(providersQuery.data ?? []).map((provider) => (
                      <option key={provider.value} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label htmlFor="llm-model" className="form-label">
                    Model Name *
                  </label>
                  <input
                    id="llm-model"
                    className="form-control"
                    value={form.model_name}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        model_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-md-6">
                  <label htmlFor="llm-endpoint" className="form-label">
                    Endpoint URL {editorNeedsEndpoint ? "*" : "(optional)"}
                  </label>
                  <input
                    id="llm-endpoint"
                    className="form-control"
                    value={form.endpoint_url}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        endpoint_url: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="col-md-6">
                  <label htmlFor="llm-api-key" className="form-label">
                    API Key {editingLLM ? "(leave blank to keep existing)" : ""}
                  </label>
                  <input
                    id="llm-api-key"
                    type="password"
                    className="form-control"
                    autoComplete="off"
                    value={form.api_key}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        api_key: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <div className="form-check mb-2">
                    <input
                      id="llm-is-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.is_active}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          is_active: event.target.checked,
                        }))
                      }
                    />
                    <label htmlFor="llm-is-active" className="form-check-label">
                      Active for selected role
                    </label>
                  </div>
                </div>

                <div className="col-12">
                  <label htmlFor="llm-config-json" className="form-label">
                    config_json (optional JSON)
                  </label>
                  <textarea
                    id="llm-config-json"
                    rows={5}
                    className={`form-control font-monospace ${configJsonError ? "is-invalid" : ""}`}
                    value={form.config_json_text}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        config_json_text: event.target.value,
                      }))
                    }
                  />
                  {configJsonError ? (
                    <div className="invalid-feedback">{configJsonError}</div>
                  ) : (
                    <div className="form-text">
                      Enter an object, e.g. <code>{"{\"temperature\":0.2}"}</code>.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sa-dialog-footer">
              <button
                type="button"
                className="btn btn-light"
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !canSave ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                onClick={() => void handleSave()}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingLLM
                    ? "Update"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
