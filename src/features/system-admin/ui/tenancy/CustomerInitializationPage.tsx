import { useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { routes } from "@/app/navigation/routes";
import {
  createWorkspaceLLM,
  parseConfigJsonInput,
} from "@/features/system-admin/api";
import type { LLMProvider, LLMRole } from "@/features/system-admin/types";
import {
  useBindWorkspace,
  useBootstrapTenancy,
  useCreateDatasource,
  useCreateOrganization,
  useCreateWorkspace,
} from "@/features/system-admin/hooks";
import type {
  DatasourceInput,
  OrganizationCreateRequest,
  TenancyBootstrapRequest,
  TenancyBootstrapResult,
  TenancyDatasource,
  TenancyDatasourceType,
  TenancyOrganization,
  WorkspaceBindingDetail,
  WorkspaceCreateRequest,
} from "@/features/system-admin/types";
import { useAppSelector } from "@/shared/runtime/hooks";
import "../systemAdmin.css";

const DATASOURCE_TYPES: TenancyDatasourceType[] = [
  "databricks",
  "snowflake",
  "mysql",
  "postgres",
  "bigquery",
];

type WizardStep = 1 | 2 | 3 | 4 | 5;

type LLMDraftRow = {
  id: string;
  name: string;
  provider: string;
  model_name: string;
  role: string;
  api_key: string;
  endpoint_url: string;
  is_active: boolean;
};

function createLLMDraftRow(): LLMDraftRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    provider: "openai",
    model_name: "",
    role: "planner",
    api_key: "",
    endpoint_url: "",
    is_active: true,
  };
}

type StepState = "pending" | "building" | "completed" | "error";

type OrganizationFormState = {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
};

type WorkspaceFormState = {
  workspace_id: string;
  name: string;
  description: string;
  is_active: boolean;
  default_catalog: string;
  default_schema: string;
};

type DatasourceFormState = {
  name: string;
  slug: string;
  type: TenancyDatasourceType;
  description: string;
  is_active: boolean;
  secret_ref: string;
  config_json_text: string;
};

type LegacyBootstrapFormState = {
  workspace_id: string;
  organization_name: string;
  organization_id: string;
  organization_slug: string;
  organization_description: string;
  datasource_name: string;
  datasource_type: TenancyDatasourceType;
  datasource_slug: string;
  datasource_description: string;
  datasource_secret_ref: string;
  datasource_config_json_text: string;
  default_catalog: string;
  default_schema: string;
  admin_user_id: string;
};

type FieldErrors = {
  organization_name?: string;
  workspace_name?: string;
  datasource_name?: string;
  datasource_config_json?: string;
};

type ApiErrorInfo = {
  status: number | null;
  message: string;
};

function parseApiError(error: unknown, fallback: string): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    const status =
      typeof error.response?.status === "number" ? error.response.status : null;
    const payload = error.response?.data as
      | { error?: string; message?: string; details?: unknown[] }
      | undefined;
    const details =
      Array.isArray(payload?.details) && payload?.details.length > 0
        ? ` ${payload.details.map((entry) => String(entry)).join(" ")}`
        : "";
    const baseMessage =
      (typeof payload?.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : null) ??
      (typeof payload?.message === "string" && payload.message.trim().length > 0
        ? payload.message
        : null) ??
      (error.message.trim().length > 0 ? error.message : null) ??
      fallback;
    return {
      status,
      message: `${baseMessage}${details}`.trim(),
    };
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return { status: null, message: error.message };
  }

  return { status: null, message: fallback };
}

function withConflictHint(
  message: string,
  status: number | null,
  hint: string,
): string {
  if (status === 409) {
    return `${message} ${hint}`.trim();
  }
  return message;
}

function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createOrganizationFormState(): OrganizationFormState {
  return {
    name: "",
    slug: "",
    description: "",
    is_active: true,
  };
}

function createWorkspaceFormState(): WorkspaceFormState {
  return {
    workspace_id: "",
    name: "",
    description: "",
    is_active: true,
    default_catalog: "",
    default_schema: "",
  };
}

function createDatasourceFormState(): DatasourceFormState {
  return {
    name: "",
    slug: "",
    type: "snowflake",
    description: "",
    is_active: true,
    secret_ref: "",
    config_json_text: JSON.stringify({}, null, 2),
  };
}

function createLegacyBootstrapFormState(
  workspaceId: string,
): LegacyBootstrapFormState {
  return {
    workspace_id: workspaceId,
    organization_name: "",
    organization_id: "",
    organization_slug: "",
    organization_description: "",
    datasource_name: "",
    datasource_type: "snowflake",
    datasource_slug: "",
    datasource_description: "",
    datasource_secret_ref: "",
    datasource_config_json_text: JSON.stringify({}, null, 2),
    default_catalog: "",
    default_schema: "",
    admin_user_id: "",
  };
}

function getStepStatus(
  step: WizardStep,
  activeStep: WizardStep,
  hasError: boolean,
  isComplete: boolean,
): StepState {
  if (isComplete && step < 5) return "completed";
  if (step < activeStep) return "completed";
  if (step === activeStep) return hasError ? "error" : "building";
  if (isComplete && step === 5) return "completed";
  return "pending";
}

export default function CustomerInitializationPage() {
  const selectedWorkspaceId = useAppSelector(
    (state) => state.userWorkspaces.selectedWorkspaceId ?? "",
  );

  const [useLegacyBootstrap, setUseLegacyBootstrap] = useState(false);
  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [stepErrorMessage, setStepErrorMessage] = useState<string | null>(null);
  const [organizationForm, setOrganizationForm] =
    useState<OrganizationFormState>(createOrganizationFormState);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState>(
    createWorkspaceFormState,
  );
  const [datasourceForm, setDatasourceForm] = useState<DatasourceFormState>(
    createDatasourceFormState,
  );
  const [legacyForm, setLegacyForm] = useState<LegacyBootstrapFormState>(() =>
    createLegacyBootstrapFormState(String(selectedWorkspaceId)),
  );

  const [organization, setOrganization] = useState<TenancyOrganization | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<WorkspaceBindingDetail | null>(
    null,
  );
  const [datasource, setDatasource] = useState<TenancyDatasource | null>(null);
  const [binding, setBinding] = useState<WorkspaceBindingDetail | null>(null);
  const [legacyResult, setLegacyResult] =
    useState<TenancyBootstrapResult | null>(null);

  const [llmDrafts, setLlmDrafts] = useState<LLMDraftRow[]>([]);
  const [llmSaveErrors, setLlmSaveErrors] = useState<string[]>([]);
  const [llmsSaved, setLlmsSaved] = useState(false);

  const createOrganizationMutation = useCreateOrganization();
  const createWorkspaceMutation = useCreateWorkspace();
  const createDatasourceMutation = useCreateDatasource();
  const bindWorkspaceMutation = useBindWorkspace();
  const legacyBootstrapMutation = useBootstrapTenancy();

  const organizationId = organization?.organization_id ?? null;
  const workspaceId = workspace?.workspace_id ?? null;
  const datasourceId = datasource?.datasource_id ?? null;

  const isFlowComplete = Boolean(binding);

  const wizardStepRows = useMemo(
    () =>
      [
        {
          step: 1 as const,
          label: "Organization",
          detail: organization ? organization.name : "Create tenant org",
        },
        {
          step: 2 as const,
          label: "Workspace",
          detail:
            workspace?.workspace_name ||
            workspace?.workspace_id ||
            "Create workspace",
        },
        {
          step: 3 as const,
          label: "Datasource",
          detail: datasource?.name || "Register datasource",
        },
        {
          step: 4 as const,
          label: "LLMs (Optional)",
          detail: llmsSaved
            ? `${llmDrafts.length} configured`
            : "Configure LLMs for workspace",
        },
        {
          step: 5 as const,
          label: "Bind + Confirm",
          detail: binding
            ? "Workspace bound to datasource"
            : "Attach datasource to workspace",
        },
      ].map((row) => ({
        ...row,
        status: getStepStatus(
          row.step,
          activeStep,
          Boolean(stepErrorMessage),
          isFlowComplete,
        ),
      })),
    [
      activeStep,
      binding,
      datasource?.name,
      llmDrafts.length,
      llmsSaved,
      organization,
      stepErrorMessage,
      workspace,
      isFlowComplete,
    ],
  );

  const resetWizard = () => {
    setActiveStep(1);
    setErrors({});
    setStepErrorMessage(null);
    setOrganization(null);
    setWorkspace(null);
    setDatasource(null);
    setBinding(null);
    setOrganizationForm(createOrganizationFormState());
    setWorkspaceForm(createWorkspaceFormState());
    setDatasourceForm(createDatasourceFormState());
    setLlmDrafts([]);
    setLlmSaveErrors([]);
    setLlmsSaved(false);
  };

  const handleCreateOrganization = async () => {
    const nextErrors: FieldErrors = {};
    const name = organizationForm.name.trim();
    if (!name) {
      nextErrors.organization_name = "Organization name is required.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: OrganizationCreateRequest = {
      name,
      slug: toOptionalString(organizationForm.slug) ?? slugify(name),
      description: toNullableString(organizationForm.description),
      is_active: organizationForm.is_active,
    };

    try {
      const created = await createOrganizationMutation.mutateAsync(payload);
      setOrganization(created);
      if (!workspaceForm.name.trim()) {
        setWorkspaceForm((prev) => ({
          ...prev,
          name: `${created.name} Workspace`,
        }));
      }
      setActiveStep(2);
      setStepErrorMessage(null);
      toast.success("Organization created.");
    } catch (error) {
      const apiError = parseApiError(error, "Unable to create organization.");
      const message = withConflictHint(
        apiError.message,
        apiError.status,
        "An organization with this name or slug may already exist.",
      );
      setStepErrorMessage(message);
      toast.error(message);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!organizationId) {
      const message = "Create an organization before creating a workspace.";
      setStepErrorMessage(message);
      toast.error(message);
      return;
    }

    const nextErrors: FieldErrors = {};
    if (!workspaceForm.workspace_id.trim() && !workspaceForm.name.trim()) {
      nextErrors.workspace_name = "Provide a workspace name or workspace_id.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: WorkspaceCreateRequest = {
      workspace_id: toOptionalString(workspaceForm.workspace_id),
      organization_id: organizationId,
      name: toOptionalString(workspaceForm.name),
      description: toNullableString(workspaceForm.description),
      is_active: workspaceForm.is_active,
      default_catalog: toNullableString(workspaceForm.default_catalog),
      default_schema: toNullableString(workspaceForm.default_schema),
    };

    try {
      const created = await createWorkspaceMutation.mutateAsync(payload);
      setWorkspace(created);
      setActiveStep(3);
      setStepErrorMessage(null);
      toast.success("Workspace created.");
    } catch (error) {
      const apiError = parseApiError(error, "Unable to create workspace.");
      const message = withConflictHint(
        apiError.message,
        apiError.status,
        "A workspace with this id or name may already exist.",
      );
      setStepErrorMessage(message);
      toast.error(message);
    }
  };

  const handleCreateDatasource = async () => {
    if (!organizationId) {
      const message = "Create an organization before creating a datasource.";
      setStepErrorMessage(message);
      toast.error(message);
      return;
    }

    const nextErrors: FieldErrors = {};
    if (!datasourceForm.name.trim()) {
      nextErrors.datasource_name = "Datasource name is required.";
    }
    let configJson: Record<string, unknown> = {};
    try {
      configJson = parseConfigJsonInput(datasourceForm.config_json_text);
    } catch (error) {
      nextErrors.datasource_config_json =
        error instanceof Error
          ? error.message
          : "config_json must be a valid JSON object.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: DatasourceInput = {
      name: datasourceForm.name.trim(),
      slug: toOptionalString(datasourceForm.slug),
      type: datasourceForm.type,
      description: toNullableString(datasourceForm.description),
      is_active: datasourceForm.is_active,
      secret_ref: toNullableString(datasourceForm.secret_ref),
      config_json: configJson,
    };

    try {
      const created = await createDatasourceMutation.mutateAsync({
        organizationId,
        payload,
      });
      setDatasource(created);
      setActiveStep(4);
      setStepErrorMessage(null);
      toast.success("Datasource created.");
    } catch (error) {
      const apiError = parseApiError(error, "Unable to create datasource.");
      const message = withConflictHint(
        apiError.message,
        apiError.status,
        "A datasource with this name or slug may already exist in this organization.",
      );
      setStepErrorMessage(message);
      toast.error(message);
    }
  };

  const handleSaveLLMs = async () => {
    if (!workspaceId) {
      setActiveStep(5);
      return;
    }
    const saveErrors: string[] = [];
    for (const draft of llmDrafts) {
      if (!draft.name.trim() || !draft.model_name.trim()) continue;
      try {
        await createWorkspaceLLM(workspaceId, {
          name: draft.name.trim(),
          provider: draft.provider as LLMProvider,
          model_name: draft.model_name.trim(),
          role: draft.role as LLMRole,
          api_key: draft.api_key.trim() || undefined,
          endpoint_url: draft.endpoint_url.trim() || null,
          is_active: draft.is_active,
        });
      } catch (err) {
        saveErrors.push(
          `${draft.name}: ${err instanceof Error ? err.message : "Failed"}`,
        );
      }
    }
    setLlmSaveErrors(saveErrors);
    if (saveErrors.length === 0) {
      setLlmsSaved(true);
      setActiveStep(5);
    }
  };

  const handleBindWorkspace = async () => {
    if (!workspaceId || !datasourceId) {
      const message =
        "Workspace and datasource must be created before binding.";
      setStepErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      const result = await bindWorkspaceMutation.mutateAsync({
        workspaceId,
        payload: {
          datasource_id: datasourceId,
        },
      });
      setBinding(result);
      setStepErrorMessage(null);
      toast.success("Workspace binding updated.");
    } catch (error) {
      const apiError = parseApiError(error, "Unable to bind workspace.");
      const message = withConflictHint(
        apiError.message,
        apiError.status,
        "Verify the selected datasource and retry.",
      );
      setStepErrorMessage(message);
      toast.error(message);
    }
  };

  const handleRunLegacyBootstrap = async () => {
    const workspace_id = legacyForm.workspace_id.trim();
    const organization_name = legacyForm.organization_name.trim();
    const datasource_name = legacyForm.datasource_name.trim();
    if (!workspace_id || !organization_name || !datasource_name) {
      toast.error(
        "workspace_id, organization_name, and datasource_name are required.",
      );
      return;
    }

    let datasource_config_json: Record<string, unknown>;
    try {
      datasource_config_json = parseConfigJsonInput(
        legacyForm.datasource_config_json_text,
      );
    } catch (error) {
      toast.error(
        parseApiError(error, "Invalid datasource config JSON.").message,
      );
      return;
    }

    const payload: TenancyBootstrapRequest = {
      workspace_id,
      organization_name,
      organization_id: toNullableString(legacyForm.organization_id),
      organization_slug: toNullableString(legacyForm.organization_slug),
      organization_description: toNullableString(
        legacyForm.organization_description,
      ),
      datasource_name,
      datasource_type: legacyForm.datasource_type,
      datasource_slug: toNullableString(legacyForm.datasource_slug),
      datasource_description: toNullableString(
        legacyForm.datasource_description,
      ),
      datasource_secret_ref: toNullableString(legacyForm.datasource_secret_ref),
      datasource_config_json,
      default_catalog: toNullableString(legacyForm.default_catalog),
      default_schema: toNullableString(legacyForm.default_schema),
      admin_user_id: toNullableString(legacyForm.admin_user_id),
    };

    try {
      const result = await legacyBootstrapMutation.mutateAsync(payload);
      setLegacyResult(result);
      toast.success("Legacy bootstrap completed.");
    } catch (error) {
      toast.error(parseApiError(error, "Legacy bootstrap failed.").message);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Customer Initialization</h1>
          <p className="sa-page-subtitle">
            Default flow: create organization, create workspace, create
            datasource, then bind workspace to datasource.
          </p>
        </div>
      </div>

      <div className="sa-card mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <div className="sa-card-title">Initialization Mode</div>
            <div className="sa-page-subtitle mb-0">
              Org-first flow is recommended for new tenants.
            </div>
          </div>
          <div className="form-check form-switch mb-0">
            <input
              id="legacy-bootstrap-toggle"
              className="form-check-input"
              type="checkbox"
              checked={useLegacyBootstrap}
              onChange={(event) => setUseLegacyBootstrap(event.target.checked)}
            />
            <label
              className="form-check-label"
              htmlFor="legacy-bootstrap-toggle"
            >
              Use legacy one-shot bootstrap
            </label>
          </div>
        </div>
      </div>

      {!useLegacyBootstrap ? (
        <>
          <div className="sa-card mb-3">
            <div className="sa-card-title">Progress</div>
            <div className="sa-stepper">
              {wizardStepRows.map((row, index) => (
                <div key={row.step} className={`sa-step ${row.status}`}>
                  <div className="sa-step-icon">{index + 1}</div>
                  <div className="sa-step-info">
                    <div className="sa-step-label">{row.label}</div>
                    <div className="sa-step-detail">{row.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {stepErrorMessage && (
            <div className="alert alert-danger" role="alert">
              {stepErrorMessage}
            </div>
          )}

          {activeStep === 1 && (
            <div className="sa-card mb-3">
              <div className="sa-card-title">Step 1: Organization</div>
              <p className="sa-page-subtitle">
                Create the tenant organization record.
              </p>
              <div className="row g-3 mt-1 sa-init-step1-row">
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Organization Name *</label>
                    <input
                      className="form-control"
                      value={organizationForm.name}
                      onChange={(event) => {
                        setOrganizationForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          organization_name: undefined,
                        }));
                      }}
                    />
                    {errors.organization_name && (
                      <div className="error">{errors.organization_name}</div>
                    )}
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Slug</label>
                    <input
                      className="form-control"
                      value={organizationForm.slug}
                      onChange={(event) =>
                        setOrganizationForm((prev) => ({
                          ...prev,
                          slug: event.target.value,
                        }))
                      }
                      placeholder="auto-generated if empty"
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={organizationForm.description}
                      onChange={(event) =>
                        setOrganizationForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <div className="form-check">
                    <input
                      id="organization-is-active"
                      className="form-check-input"
                      type="checkbox"
                      checked={organizationForm.is_active}
                      onChange={(event) =>
                        setOrganizationForm((prev) => ({
                          ...prev,
                          is_active: event.target.checked,
                        }))
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="organization-is-active"
                    >
                      Active
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3 d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateOrganization}
                  disabled={
                    createOrganizationMutation.isPending ||
                    !organizationForm.name.trim()
                  }
                >
                  {createOrganizationMutation.isPending
                    ? "Creating..."
                    : "Create Organization"}
                </button>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="sa-card mb-3">
              <div className="sa-card-title">Step 2: Workspace</div>
              <p className="sa-page-subtitle">
                Create a workspace for{" "}
                <strong>{organization?.name ?? "selected organization"}</strong>
                .
              </p>
              <div className="row g-3 mt-1">
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>workspace_id (optional)</label>
                    <input
                      className="form-control"
                      value={workspaceForm.workspace_id}
                      onChange={(event) =>
                        setWorkspaceForm((prev) => ({
                          ...prev,
                          workspace_id: event.target.value,
                        }))
                      }
                    />
                    <div className="hint">
                      If omitted, backend may generate one.
                    </div>
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Workspace Name</label>
                    <input
                      className="form-control"
                      value={workspaceForm.name}
                      onChange={(event) => {
                        setWorkspaceForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          workspace_name: undefined,
                        }));
                      }}
                    />
                    {errors.workspace_name && (
                      <div className="error">{errors.workspace_name}</div>
                    )}
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={workspaceForm.description}
                      onChange={(event) =>
                        setWorkspaceForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Default Catalog</label>
                    <input
                      className="form-control"
                      value={workspaceForm.default_catalog}
                      onChange={(event) =>
                        setWorkspaceForm((prev) => ({
                          ...prev,
                          default_catalog: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Default Schema</label>
                    <input
                      className="form-control"
                      value={workspaceForm.default_schema}
                      onChange={(event) =>
                        setWorkspaceForm((prev) => ({
                          ...prev,
                          default_schema: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <div className="form-check">
                    <input
                      id="workspace-is-active"
                      className="form-check-input"
                      type="checkbox"
                      checked={workspaceForm.is_active}
                      onChange={(event) =>
                        setWorkspaceForm((prev) => ({
                          ...prev,
                          is_active: event.target.checked,
                        }))
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="workspace-is-active"
                    >
                      Active
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setActiveStep(1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateWorkspace}
                  disabled={
                    createWorkspaceMutation.isPending ||
                    !(
                      workspaceForm.workspace_id.trim() ||
                      workspaceForm.name.trim()
                    ) ||
                    !organizationId
                  }
                >
                  {createWorkspaceMutation.isPending
                    ? "Creating..."
                    : "Create Workspace"}
                </button>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="sa-card mb-3">
              <div className="sa-card-title">Step 3: Datasource</div>
              <p className="sa-page-subtitle">
                Register datasource credentials and connection metadata.
              </p>
              <div className="row g-3 mt-1">
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Datasource Name *</label>
                    <input
                      className="form-control"
                      value={datasourceForm.name}
                      onChange={(event) => {
                        setDatasourceForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          datasource_name: undefined,
                        }));
                      }}
                    />
                    {errors.datasource_name && (
                      <div className="error">{errors.datasource_name}</div>
                    )}
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Type *</label>
                    <select
                      className="form-select"
                      value={datasourceForm.type}
                      onChange={(event) =>
                        setDatasourceForm((prev) => ({
                          ...prev,
                          type: event.target.value as TenancyDatasourceType,
                        }))
                      }
                    >
                      {DATASOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Slug</label>
                    <input
                      className="form-control"
                      value={datasourceForm.slug}
                      onChange={(event) =>
                        setDatasourceForm((prev) => ({
                          ...prev,
                          slug: event.target.value,
                        }))
                      }
                      placeholder="optional"
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Secret Ref</label>
                    <input
                      className="form-control"
                      value={datasourceForm.secret_ref}
                      onChange={(event) =>
                        setDatasourceForm((prev) => ({
                          ...prev,
                          secret_ref: event.target.value,
                        }))
                      }
                      placeholder="env:ACME_WAREHOUSE_SECRET"
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>Description</label>
                    <input
                      className="form-control"
                      value={datasourceForm.description}
                      onChange={(event) =>
                        setDatasourceForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <label className="sa-field mb-0">
                    <label>config_json *</label>
                    <textarea
                      className="form-control font-monospace"
                      rows={8}
                      value={datasourceForm.config_json_text}
                      onChange={(event) => {
                        setDatasourceForm((prev) => ({
                          ...prev,
                          config_json_text: event.target.value,
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          datasource_config_json: undefined,
                        }));
                      }}
                    />
                    {errors.datasource_config_json && (
                      <div className="error">
                        {errors.datasource_config_json}
                      </div>
                    )}
                  </label>
                </div>
                <div className="col-12 sa-init-step1-col">
                  <div className="form-check">
                    <input
                      id="datasource-is-active"
                      className="form-check-input"
                      type="checkbox"
                      checked={datasourceForm.is_active}
                      onChange={(event) =>
                        setDatasourceForm((prev) => ({
                          ...prev,
                          is_active: event.target.checked,
                        }))
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="datasource-is-active"
                    >
                      Active
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setActiveStep(2)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateDatasource}
                  disabled={
                    createDatasourceMutation.isPending ||
                    !datasourceForm.name.trim()
                  }
                >
                  {createDatasourceMutation.isPending
                    ? "Creating..."
                    : "Create Datasource"}
                </button>
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div className="sa-card mb-3">
              <div className="sa-card-title">
                Step 4: Configure LLMs (Optional)
              </div>
              <p className="sa-page-subtitle">
                Assign LLM models to pipeline roles for workspace{" "}
                <strong>{workspaceId ?? "-"}</strong>. You can skip this step
                and configure LLMs later from System Admin → Tenancy → Workspace
                LLMs.
              </p>

              {llmDrafts.map((draft, idx) => (
                <div key={draft.id} className="border rounded p-3 mb-3">
                  <div className="d-flex justify-content-between mb-2">
                    <strong>LLM {idx + 1}</strong>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() =>
                        setLlmDrafts((prev) =>
                          prev.filter((r) => r.id !== draft.id),
                        )
                      }
                      aria-label={`Remove LLM ${idx + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label
                        htmlFor={`llm-name-${draft.id}`}
                        className="form-label"
                      >
                        Name
                      </label>
                      <input
                        id={`llm-name-${draft.id}`}
                        className="form-control form-control-sm"
                        value={draft.name}
                        onChange={(e) =>
                          setLlmDrafts((prev) =>
                            prev.map((r) =>
                              r.id === draft.id
                                ? { ...r, name: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <label
                        htmlFor={`llm-provider-${draft.id}`}
                        className="form-label"
                      >
                        Provider
                      </label>
                      <select
                        id={`llm-provider-${draft.id}`}
                        className="form-select form-select-sm"
                        value={draft.provider}
                        onChange={(e) =>
                          setLlmDrafts((prev) =>
                            prev.map((r) =>
                              r.id === draft.id
                                ? { ...r, provider: e.target.value }
                                : r,
                            ),
                          )
                        }
                      >
                        {[
                          "openai",
                          "anthropic",
                          "azure_openai",
                          "ollama",
                          "generic",
                        ].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label
                        htmlFor={`llm-role-${draft.id}`}
                        className="form-label"
                      >
                        Role
                      </label>
                      <select
                        id={`llm-role-${draft.id}`}
                        className="form-select form-select-sm"
                        value={draft.role}
                        onChange={(e) =>
                          setLlmDrafts((prev) =>
                            prev.map((r) =>
                              r.id === draft.id
                                ? { ...r, role: e.target.value }
                                : r,
                            ),
                          )
                        }
                      >
                        {[
                          "planner",
                          "ner",
                          "summarizer",
                          "query_generator",
                          "enrichment",
                        ].map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label
                        htmlFor={`llm-model-${draft.id}`}
                        className="form-label"
                      >
                        Model Name
                      </label>
                      <input
                        id={`llm-model-${draft.id}`}
                        className="form-control form-control-sm"
                        value={draft.model_name}
                        onChange={(e) =>
                          setLlmDrafts((prev) =>
                            prev.map((r) =>
                              r.id === draft.id
                                ? { ...r, model_name: e.target.value }
                                : r,
                            ),
                          )
                        }
                        placeholder="e.g. gpt-4o"
                      />
                    </div>
                    <div className="col-md-4">
                      <label
                        htmlFor={`llm-key-${draft.id}`}
                        className="form-label"
                      >
                        API Key
                      </label>
                      <input
                        id={`llm-key-${draft.id}`}
                        type="password"
                        className="form-control form-control-sm"
                        value={draft.api_key}
                        onChange={(e) =>
                          setLlmDrafts((prev) =>
                            prev.map((r) =>
                              r.id === draft.id
                                ? { ...r, api_key: e.target.value }
                                : r,
                            ),
                          )
                        }
                        autoComplete="off"
                        aria-label="API key (masked)"
                      />
                    </div>
                    {["azure_openai", "ollama", "generic"].includes(
                      draft.provider,
                    ) && (
                      <div className="col-md-6">
                        <label
                          htmlFor={`llm-endpoint-${draft.id}`}
                          className="form-label"
                        >
                          Endpoint URL
                        </label>
                        <input
                          id={`llm-endpoint-${draft.id}`}
                          className="form-control form-control-sm"
                          value={draft.endpoint_url}
                          onChange={(e) =>
                            setLlmDrafts((prev) =>
                              prev.map((r) =>
                                r.id === draft.id
                                  ? { ...r, endpoint_url: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          placeholder="https://..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {llmSaveErrors.length > 0 && (
                <div className="alert alert-warning" role="alert">
                  Some LLMs failed to save:
                  <ul className="mb-0 mt-1">
                    {llmSaveErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mb-3"
                onClick={() =>
                  setLlmDrafts((prev) => [...prev, createLLMDraftRow()])
                }
              >
                + Add LLM
              </button>

              <div className="mt-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setActiveStep(3)}
                >
                  Back
                </button>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => setActiveStep(5)}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSaveLLMs()}
                    disabled={llmDrafts.length === 0}
                  >
                    Save LLMs &amp; Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeStep === 5 && (
            <div className="sa-card mb-3">
              <div className="sa-card-title">Step 5: Bind + Confirm</div>
              <p className="sa-page-subtitle">
                Bind workspace <strong>{workspaceId ?? "-"}</strong> to
                datasource <strong>{datasource?.name ?? "-"}</strong>.
              </p>
              <div className="sa-stats-row sa-init-step4-stats mt-3">
                <div className="sa-stat-card">
                  <div className="sa-stat-label">Organization ID</div>
                  <div className="sa-stat-value">{organizationId ?? "-"}</div>
                </div>
                <div className="sa-stat-card">
                  <div className="sa-stat-label">Workspace ID</div>
                  <div className="sa-stat-value">{workspaceId ?? "-"}</div>
                </div>
                <div className="sa-stat-card">
                  <div className="sa-stat-label">Datasource ID</div>
                  <div className="sa-stat-value">{datasourceId ?? "-"}</div>
                </div>
              </div>

              <div className="mt-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setActiveStep(4)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleBindWorkspace}
                  disabled={
                    bindWorkspaceMutation.isPending ||
                    !workspaceId ||
                    !datasourceId
                  }
                >
                  {bindWorkspaceMutation.isPending
                    ? "Binding..."
                    : binding
                      ? "Rebind Workspace"
                      : "Bind Workspace"}
                </button>
              </div>

              {binding && (
                <div className="mt-4">
                  <div className="alert alert-success mb-3" role="alert">
                    Onboarding complete. Workspace binding is active.
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Link
                      className="btn btn-outline-primary btn-sm"
                      to={routes.AdminTenancyOrganizations}
                    >
                      Manage Organization Memberships
                    </Link>
                    <Link
                      className="btn btn-outline-primary btn-sm"
                      to={routes.AdminTenancyWorkspaceBindings}
                    >
                      Manage Workspace Memberships
                    </Link>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={resetWizard}
                    >
                      Start Another Initialization
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="sa-card mb-3">
            <div className="sa-card-title">
              Legacy / Advanced: One-shot Bootstrap
            </div>
            <p className="sa-page-subtitle">
              Uses <code>POST /api/v1/admin/tenancy/bootstrap</code>. This path
              is retained for backward compatibility.
            </p>
            <div className="row g-3 mt-1">
              <div className="col-md-4">
                <label className="sa-field mb-0">
                  <label>workspace_id *</label>
                  <input
                    className="form-control"
                    value={legacyForm.workspace_id}
                    onChange={(event) =>
                      setLegacyForm((prev) => ({
                        ...prev,
                        workspace_id: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="col-md-4">
                <label className="sa-field mb-0">
                  <label>organization_name *</label>
                  <input
                    className="form-control"
                    value={legacyForm.organization_name}
                    onChange={(event) =>
                      setLegacyForm((prev) => ({
                        ...prev,
                        organization_name: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="col-md-4">
                <label className="sa-field mb-0">
                  <label>datasource_name *</label>
                  <input
                    className="form-control"
                    value={legacyForm.datasource_name}
                    onChange={(event) =>
                      setLegacyForm((prev) => ({
                        ...prev,
                        datasource_name: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="col-md-4">
                <label className="sa-field mb-0">
                  <label>datasource_type *</label>
                  <select
                    className="form-select"
                    value={legacyForm.datasource_type}
                    onChange={(event) =>
                      setLegacyForm((prev) => ({
                        ...prev,
                        datasource_type: event.target
                          .value as TenancyDatasourceType,
                      }))
                    }
                  >
                    {DATASOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="col-md-4">
                <label className="sa-field mb-0">
                  <label>default_catalog</label>
                  <input
                    className="form-control"
                    value={legacyForm.default_catalog}
                    onChange={(event) =>
                      setLegacyForm((prev) => ({
                        ...prev,
                        default_catalog: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="col-md-4">
                <label className="sa-field mb-0">
                  <label>default_schema</label>
                  <input
                    className="form-control"
                    value={legacyForm.default_schema}
                    onChange={(event) =>
                      setLegacyForm((prev) => ({
                        ...prev,
                        default_schema: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="col-12">
                <label className="sa-field mb-0">
                  <label>datasource_config_json *</label>
                  <textarea
                    className="form-control font-monospace"
                    rows={8}
                    value={legacyForm.datasource_config_json_text}
                    onChange={(event) =>
                      setLegacyForm((prev) => ({
                        ...prev,
                        datasource_config_json_text: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRunLegacyBootstrap}
                disabled={legacyBootstrapMutation.isPending}
              >
                {legacyBootstrapMutation.isPending
                  ? "Running..."
                  : "Run Legacy Bootstrap"}
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() =>
                  setLegacyForm(
                    createLegacyBootstrapFormState(String(selectedWorkspaceId)),
                  )
                }
                disabled={legacyBootstrapMutation.isPending}
              >
                Reset
              </button>
            </div>
          </div>

          {legacyResult && (
            <div className="sa-card mb-3">
              <div className="sa-card-title">Legacy Run Result</div>
              <pre className="sa-json-block mt-2">
                {JSON.stringify(legacyResult, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
