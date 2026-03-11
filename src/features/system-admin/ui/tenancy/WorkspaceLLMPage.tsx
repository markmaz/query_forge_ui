import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  useLLMProviders,
  useLLMRoles,
  useWorkspaceLLMs,
  useCreateWorkspaceLLM,
  useDeleteWorkspaceLLM,
  useTestWorkspaceLLM,
} from "@/features/system-admin/hooks";
import { updateWorkspaceLLM } from "@/features/system-admin/api";
import { llmKeys } from "@/features/system-admin/hooks/useWorkspaceLLM";
import type {
  WorkspaceLLM,
  WorkspaceLLMCreateRequest,
  LLMProvider,
  LLMRole,
} from "@/features/system-admin/types";
import "../systemAdmin.css";

const ENDPOINT_PROVIDERS: LLMProvider[] = ["azure_openai", "ollama", "generic"];

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

function formToPayload(form: FormState): WorkspaceLLMCreateRequest {
  let config_json: Record<string, unknown> | null = null;
  if (form.config_json_text.trim()) {
    try {
      config_json = JSON.parse(form.config_json_text) as Record<
        string,
        unknown
      >;
    } catch {
      config_json = null;
    }
  }
  return {
    name: form.name.trim(),
    provider: form.provider,
    model_name: form.model_name.trim(),
    role: form.role,
    api_key: form.api_key.trim() || undefined,
    endpoint_url: form.endpoint_url.trim() || null,
    is_active: form.is_active,
    config_json,
  };
}

export default function WorkspaceLLMPage() {
  const queryClient = useQueryClient();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingLLM, setEditingLLM] = useState<WorkspaceLLM | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [testResult, setTestResult] = useState<{
    id: number;
    success: boolean;
    message: string;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const wsId = selectedWorkspaceId.trim() || null;

  const rolesQuery = useLLMRoles();
  const providersQuery = useLLMProviders();
  const llmsQuery = useWorkspaceLLMs(wsId);
  const createMutation = useCreateWorkspaceLLM(wsId ?? "");
  const deleteMutation = useDeleteWorkspaceLLM(wsId ?? "");
  const testMutation = useTestWorkspaceLLM(wsId ?? "");

  const openAdd = () => {
    setEditingLLM(null);
    setForm(createEmptyForm());
    setTestResult(null);
    setShowForm(true);
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
    setTestResult(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!wsId) return;
    const payload = formToPayload(form);
    try {
      if (editingLLM) {
        await updateWorkspaceLLM(wsId, editingLLM.id, payload);
        void queryClient.invalidateQueries({
          queryKey: llmKeys.workspace(wsId),
        });
        toast.success("LLM configuration updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("LLM configuration created.");
      }
      setShowForm(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to save LLM configuration.";
      toast.error(msg);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirmId(null);
      toast.success("LLM configuration deleted.");
    } catch {
      toast.error("Failed to delete LLM configuration.");
    }
  };

  const handleTest = async (llm: WorkspaceLLM) => {
    if (!wsId) return;
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync(llm.id);
      setTestResult({ id: llm.id, ...result });
    } catch {
      setTestResult({
        id: llm.id,
        success: false,
        message: "Connection test failed.",
      });
    }
  };

  const needsEndpoint = ENDPOINT_PROVIDERS.includes(form.provider);

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Workspace LLM Configuration</h1>
          <p className="sa-page-subtitle">
            Assign LLM models to pipeline roles for each workspace.
          </p>
        </div>
      </div>

      <div className="sa-card mb-3">
        <label htmlFor="ws-selector" className="sa-card-title mb-2 d-block">
          Select Workspace
        </label>
        <input
          id="ws-selector"
          className="form-control"
          style={{ maxWidth: 400 }}
          placeholder="Enter workspace ID"
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          aria-label="Workspace ID"
        />
      </div>

      {wsId && (
        <>
          <div className="sa-card mb-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="sa-card-title mb-0">LLM Configurations</div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openAdd}
                aria-label="Add LLM configuration"
              >
                + Add LLM
              </button>
            </div>

            {llmsQuery.isLoading && (
              <div className="text-muted">Loading...</div>
            )}
            {llmsQuery.isError && (
              <div className="alert alert-danger" role="alert">
                Failed to load LLM configurations.
              </div>
            )}

            {llmsQuery.data && llmsQuery.data.length === 0 && (
              <div className="text-muted py-3 text-center">
                No LLM configurations for this workspace. Click + Add LLM to get
                started.
              </div>
            )}

            {llmsQuery.data && llmsQuery.data.length > 0 && (
              <div className="table-responsive">
                <table
                  className="table table-hover align-middle"
                  aria-label="LLM configurations"
                >
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Provider</th>
                      <th scope="col">Model</th>
                      <th scope="col">API Key</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {llmsQuery.data.map((llm) => (
                      <tr key={llm.id}>
                        <td>{llm.name}</td>
                        <td>
                          <span className="badge bg-secondary">{llm.role}</span>
                        </td>
                        <td>{llm.provider}</td>
                        <td>
                          <code>{llm.model_name}</code>
                        </td>
                        <td>
                          {llm.has_api_key ? (
                            <span
                              className="text-muted"
                              aria-label="API key configured"
                            >
                              {llm.masked_api_key ?? "••••"}
                            </span>
                          ) : (
                            <span
                              className="text-muted"
                              aria-label="No API key"
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${llm.is_active ? "bg-success" : "bg-secondary"}`}
                          >
                            {llm.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => openEdit(llm)}
                              aria-label={`Edit ${llm.name}`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => void handleTest(llm)}
                              disabled={testMutation.isPending}
                              aria-label={`Test connection for ${llm.name}`}
                            >
                              Test
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => setDeleteConfirmId(llm.id)}
                              aria-label={`Delete ${llm.name}`}
                            >
                              Delete
                            </button>
                          </div>
                          {testResult?.id === llm.id && (
                            <div
                              className={`mt-1 small ${testResult.success ? "text-success" : "text-danger"}`}
                              role="status"
                              aria-live="polite"
                            >
                              {testResult.success ? "✓" : "✗"}{" "}
                              {testResult.message}
                            </div>
                          )}
                          {deleteConfirmId === llm.id && (
                            <div className="mt-1 d-flex gap-1 align-items-center">
                              <span className="small text-danger">
                                Confirm delete?
                              </span>
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
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showForm && (
            <div
              className="sa-card mb-3"
              role="region"
              aria-label={editingLLM ? "Edit LLM" : "Add LLM"}
            >
              <div className="sa-card-title">
                {editingLLM
                  ? `Edit: ${editingLLM.name}`
                  : "Add LLM Configuration"}
              </div>
              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <label htmlFor="llm-name" className="form-label">
                    Name *
                  </label>
                  <input
                    id="llm-name"
                    className="form-control"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label htmlFor="llm-provider" className="form-label">
                    Provider *
                  </label>
                  <select
                    id="llm-provider"
                    className="form-select"
                    value={form.provider}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        provider: e.target.value as LLMProvider,
                      }))
                    }
                  >
                    {(providersQuery.data ?? []).map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3">
                  <label htmlFor="llm-role" className="form-label">
                    Role *
                  </label>
                  <select
                    id="llm-role"
                    className="form-select"
                    value={form.role}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        role: e.target.value as LLMRole,
                      }))
                    }
                  >
                    {(rolesQuery.data ?? []).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
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
                    onChange={(e) =>
                      setForm((p) => ({ ...p, model_name: e.target.value }))
                    }
                    placeholder="e.g. gpt-4o, claude-sonnet-4-6, llama3"
                    required
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
                    value={form.api_key}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, api_key: e.target.value }))
                    }
                    autoComplete="off"
                    aria-describedby="api-key-hint"
                  />
                  <div id="api-key-hint" className="form-text">
                    {editingLLM?.has_api_key
                      ? `Currently set: ${editingLLM.masked_api_key ?? "••••"}. Enter new key to replace.`
                      : "API key is encrypted at rest."}
                  </div>
                </div>

                {needsEndpoint && (
                  <div className="col-12">
                    <label htmlFor="llm-endpoint" className="form-label">
                      Endpoint URL *
                    </label>
                    <input
                      id="llm-endpoint"
                      className="form-control"
                      value={form.endpoint_url}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, endpoint_url: e.target.value }))
                      }
                      placeholder="https://your-resource.openai.azure.com"
                      aria-required="true"
                    />
                  </div>
                )}

                <div className="col-12">
                  <div className="form-check">
                    <input
                      id="llm-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, is_active: e.target.checked }))
                      }
                    />
                    <label htmlFor="llm-active" className="form-check-label">
                      Active
                    </label>
                  </div>
                </div>

                <div className="col-12">
                  <details>
                    <summary
                      className="text-muted small"
                      style={{ cursor: "pointer" }}
                    >
                      Advanced config (optional JSON)
                    </summary>
                    <div className="mt-2">
                      <label htmlFor="llm-config" className="form-label">
                        config_json
                      </label>
                      <textarea
                        id="llm-config"
                        className="form-control font-monospace"
                        rows={4}
                        value={form.config_json_text}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            config_json_text: e.target.value,
                          }))
                        }
                        aria-label="Optional JSON configuration"
                      />
                    </div>
                  </details>
                </div>
              </div>

              <div className="mt-3 d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleSave()}
                  disabled={
                    createMutation.isPending ||
                    !form.name.trim() ||
                    !form.model_name.trim()
                  }
                >
                  {createMutation.isPending
                    ? "Saving..."
                    : editingLLM
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
