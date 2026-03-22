import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useCreateDatasource,
  useDeleteDatasource,
  useOrganizationDatasources,
  useOrganizations,
  useTestDatasource,
  useUpdateDatasource,
} from "@/features/system-admin/hooks";
import { formatConfigJson, parseConfigJsonInput } from "@/features/system-admin/api";
import type {
  DatasourceInput,
  DatasourceTestResult,
  TenancyDatasource,
} from "@/features/system-admin/types";
import {
  buildSnowflakeDatasourceConfig,
  createSnowflakeDatasourceFormState,
  type SnowflakeDatasourceFormState,
} from "./snowflakeDatasourceConfig";
import {
  buildDatabricksDatasourceConfig,
  createDatabricksDatasourceFormState,
  type DatabricksDatasourceFormState,
} from "./databricksDatasourceConfig";
import {
  getDatasourceConfigHelpText,
  getDatasourceConfigSampleText,
} from "./datasourceConfigSamples";
import "../systemAdmin.css";

const LIMIT_OPTIONS = [25, 50, 100, 200] as const;

const DATASOURCE_TYPES = ["postgres", "snowflake", "databricks", "bigquery", "mysql"] as const;

type DatasourceFormState = {
  name: string;
  slug: string;
  type: string;
  description: string;
  is_active: boolean;
  secret_ref: string;
  config_json_text: string;
  databricks: DatabricksDatasourceFormState;
  snowflake: SnowflakeDatasourceFormState;
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function createDatasourceFormState(row?: TenancyDatasource | null): DatasourceFormState {
  const type = row?.type ?? "postgres";
  return {
    name: row?.name ?? "",
    slug: row?.slug ?? "",
    type,
    description: row?.description ?? "",
    is_active: row?.is_active ?? true,
    secret_ref: row?.secret_ref ?? "",
    config_json_text:
      row != null
        ? type === "snowflake" || type === "databricks"
          ? "{}"
          : formatConfigJson(row?.config_json)
        : getDatasourceConfigSampleText(type),
    databricks: createDatabricksDatasourceFormState(
      type === "databricks"
        ? row?.config_json ?? { session_configuration: { ansi_mode: "true" } }
        : null
    ),
    snowflake: createSnowflakeDatasourceFormState(
      type === "snowflake"
        ? row?.config_json ?? { query_tag: "query_forge" }
        : null
    ),
  };
}

function statusBadgeClass(status: string | null): string {
  const value = (status ?? "").toLowerCase();
  if (value.includes("ok") || value.includes("pass") || value.includes("success")) {
    return "badge text-bg-success";
  }
  if (value.includes("warn")) {
    return "badge text-bg-warning";
  }
  if (value.includes("error") || value.includes("fail")) {
    return "badge text-bg-danger";
  }
  return "badge text-bg-secondary";
}

export default function TenancyDatasourcesPage() {
  const [organizationId, setOrganizationId] = useState<string>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [limit, setLimit] = useState<number>(25);
  const [offset, setOffset] = useState(0);
  const [drawerDatasource, setDrawerDatasource] = useState<TenancyDatasource | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<DatasourceFormState>(createDatasourceFormState());
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenancyDatasource | null>(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [lastTestResults, setLastTestResults] = useState<Record<string, DatasourceTestResult>>({});

  const organizationsQuery = useOrganizations({ include_inactive: true, limit: 500, offset: 0 });

  useEffect(() => {
    if (!organizationId) {
      const firstOrgId = organizationsQuery.data?.rows?.[0]?.organization_id;
      if (firstOrgId) {
        setOrganizationId(firstOrgId);
      }
    }
  }, [organizationId, organizationsQuery.data?.rows]);

  const datasourcesParams = useMemo(
    () => ({ include_inactive: includeInactive, limit, offset }),
    [includeInactive, limit, offset]
  );

  const datasourcesQuery = useOrganizationDatasources(
    organizationId || null,
    datasourcesParams,
    Boolean(organizationId)
  );

  const createDatasourceMutation = useCreateDatasource();
  const updateDatasourceMutation = useUpdateDatasource();
  const deleteDatasourceMutation = useDeleteDatasource();
  const testDatasourceMutation = useTestDatasource();

  const rows = datasourcesQuery.data?.rows ?? [];
  const total = datasourcesQuery.data?.total ?? 0;
  const canGoPrevious = offset > 0;
  const canGoNext = offset + limit < total;

  const openCreateDrawer = () => {
    if (!organizationId) {
      toast.error("Select an organization first.");
      return;
    }
    setDrawerDatasource(null);
    setFormState(createDatasourceFormState());
    setJsonError(null);
    setIsDrawerOpen(true);
  };

  const openDrawerForDatasource = (row: TenancyDatasource) => {
    setDrawerDatasource(row);
    setFormState(createDatasourceFormState(row));
    setJsonError(null);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (createDatasourceMutation.isPending || updateDatasourceMutation.isPending) return;
    setIsDrawerOpen(false);
  };

  const handleDatasourceTypeChange = (nextType: string) => {
    setFormState((prev) => {
      if (prev.type === nextType) return prev;

      if (nextType === "snowflake") {
        return {
          ...prev,
          type: nextType,
          snowflake: createSnowflakeDatasourceFormState({
            query_tag: "query_forge",
          }),
        };
      }
      if (nextType === "databricks") {
        return {
          ...prev,
          type: nextType,
          databricks: createDatabricksDatasourceFormState({
            session_configuration: { ansi_mode: "true" },
          }),
        };
      }

      return {
        ...prev,
        type: nextType,
        config_json_text: getDatasourceConfigSampleText(nextType),
      };
    });
    if (jsonError) setJsonError(null);
  };

  const handleSnowflakeKeyUpload = async (file: File | null) => {
    if (!file) return;
    const pem = await file.text();
    setFormState((prev) => ({
      ...prev,
      snowflake: {
        ...prev.snowflake,
        private_key_pem: pem,
        private_key_pem_configured: pem.trim().length > 0,
      },
    }));
  };

  const handleSaveDatasource = () => {
    if (!organizationId) {
      toast.error("Organization is required.");
      return;
    }

    let config_json: Record<string, unknown>;
    if (formState.type === "snowflake") {
      const snowflake = formState.snowflake;
      if (!snowflake.account.trim() || !snowflake.user.trim() || !snowflake.database.trim()) {
        toast.error("Snowflake account, user, and database are required.");
        return;
      }
      if (
        snowflake.auth_method === "password" &&
        !snowflake.password.trim() &&
        !snowflake.password_configured &&
        !formState.secret_ref.trim()
      ) {
        toast.error("Provide a Snowflake password or secret_ref.");
        return;
      }
      if (
        snowflake.auth_method === "rsa_key" &&
        !snowflake.private_key_pem.trim() &&
        !snowflake.private_key_pem_configured
      ) {
        toast.error("Provide a Snowflake private key PEM.");
        return;
      }
      try {
        config_json = buildSnowflakeDatasourceConfig(snowflake, parseConfigJsonInput);
        setJsonError(null);
      } catch (error) {
        const message = toErrorMessage(error, "Invalid Snowflake extra JSON.");
        setJsonError(message);
        toast.error(message);
        return;
      }
    } else if (formState.type === "databricks") {
      const databricks = formState.databricks;
      if (!databricks.host.trim() || !databricks.http_path.trim()) {
        toast.error("Databricks host and HTTP path are required.");
        return;
      }
      if (
        databricks.auth_method === "token" &&
        !databricks.token.trim() &&
        !databricks.token_configured &&
        !formState.secret_ref.trim()
      ) {
        toast.error("Provide a Databricks token, secret_ref, or switch to OAuth.");
        return;
      }
      if (
        databricks.auth_method === "oauth_client_credentials" &&
        ((!databricks.client_id.trim() && !databricks.client_id_configured) ||
          (!databricks.client_secret.trim() && !databricks.client_secret_configured))
      ) {
        toast.error("Provide Databricks OAuth client_id and client_secret.");
        return;
      }
      try {
        config_json = buildDatabricksDatasourceConfig(databricks, parseConfigJsonInput);
        setJsonError(null);
      } catch (error) {
        const message = toErrorMessage(error, "Invalid Databricks extra JSON.");
        setJsonError(message);
        toast.error(message);
        return;
      }
    } else {
      try {
        config_json = parseConfigJsonInput(formState.config_json_text);
        setJsonError(null);
      } catch (error) {
        const message = toErrorMessage(error, "Invalid JSON config.");
        setJsonError(message);
        toast.error(message);
        return;
      }
    }

    const payload: DatasourceInput = {
      name: formState.name.trim(),
      slug: formState.slug.trim(),
      type: formState.type.trim(),
      description: formState.description.trim() || null,
      is_active: formState.is_active,
      secret_ref: formState.secret_ref.trim() || null,
      config_json,
    };

    if (!payload.name || !payload.slug || !payload.type) {
      toast.error("Name, slug, and type are required.");
      return;
    }

    if (drawerDatasource) {
      updateDatasourceMutation.mutate(
        { datasourceId: drawerDatasource.datasource_id, payload },
        {
          onSuccess: () => {
            toast.success("Datasource updated.");
            setDrawerDatasource((prev) =>
              prev
                ? {
                    ...prev,
                    ...payload,
                    description: payload.description ?? null,
                    secret_ref: payload.secret_ref ?? null,
                    config_json: payload.config_json ?? {},
                  }
                : prev
            );
          },
          onError: (error) => toast.error(toErrorMessage(error, "Unable to update datasource.")),
        }
      );
      return;
    }

    createDatasourceMutation.mutate(
      { organizationId, payload },
      {
        onSuccess: () => {
          toast.success("Datasource created.");
          setIsDrawerOpen(false);
        },
        onError: (error) => toast.error(toErrorMessage(error, "Unable to create datasource.")),
      }
    );
  };

  const handleDeleteDatasource = () => {
    if (!deleteTarget) return;
    deleteDatasourceMutation.mutate(
      {
        datasourceId: deleteTarget.datasource_id,
        hard: hardDelete,
      },
      {
        onSuccess: () => {
          toast.success(hardDelete ? "Datasource hard deleted." : "Datasource deleted.");
          setDeleteTarget(null);
          setHardDelete(false);
          if (drawerDatasource?.datasource_id === deleteTarget.datasource_id) {
            setDrawerDatasource(null);
            setIsDrawerOpen(false);
          }
        },
        onError: (error) => toast.error(toErrorMessage(error, "Unable to delete datasource.")),
      }
    );
  };

  const runDatasourceTest = (row: TenancyDatasource) => {
    testDatasourceMutation.mutate(row.datasource_id, {
      onSuccess: (result) => {
        setLastTestResults((prev) => ({
          ...prev,
          [row.datasource_id]: result,
        }));
        toast.success(`Test ${result.success ? "passed" : "completed with issues"}.`);
      },
      onError: (error) => {
        toast.error(toErrorMessage(error, "Datasource test failed."));
      },
    });
  };

  const selectedTestResult = drawerDatasource ? lastTestResults[drawerDatasource.datasource_id] : null;

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Datasources</h1>
          <p className="sa-page-subtitle">Admin tenancy datasources managed by organization.</p>
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={openCreateDrawer}>
          <i className="fa fa-plus" /> New Datasource
        </button>
      </div>

      <div className="sa-toolbar">
        <label className="sa-field mb-0" style={{ minWidth: 280 }}>
          <span>Organization</span>
          <select
            className="form-select form-select-sm"
            value={organizationId}
            onChange={(event) => {
              setOrganizationId(event.target.value);
              setOffset(0);
              setIsDrawerOpen(false);
            }}
          >
            {!organizationId && <option value="">Select organization</option>}
            {(organizationsQuery.data?.rows ?? []).map((org) => (
              <option key={org.organization_id} value={org.organization_id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>

        <label className="sa-field mb-0">
          <span>Limit</span>
          <select
            className="form-select form-select-sm"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setOffset(0);
            }}
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="form-check mb-0 mt-3">
          <input
            className="form-check-input"
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => {
              setIncludeInactive(event.target.checked);
              setOffset(0);
            }}
          />
          <span className="form-check-label">Include inactive</span>
        </label>

        <button
          type="button"
          className="btn btn-sm btn-outline-primary mt-3"
          onClick={() => void datasourcesQuery.refetch()}
          disabled={datasourcesQuery.isFetching || !organizationId}
        >
          <i className="fa fa-refresh" /> Refresh
        </button>
      </div>

      {datasourcesQuery.isError && (
        <div className="alert alert-danger" role="alert">
          {toErrorMessage(datasourcesQuery.error, "Unable to load datasources.")}
        </div>
      )}

      {!organizationId ? (
        <div className="admin-empty-card">Select an organization to manage datasources.</div>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
              {total} datasources
            </span>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={!canGoPrevious || datasourcesQuery.isFetching}
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={!canGoNext || datasourcesQuery.isFetching}
                onClick={() => setOffset((prev) => prev + limit)}
              >
                Next
              </button>
            </div>
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Type</th>
                  <th>Active</th>
                  <th>Last Test</th>
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const testResult = lastTestResults[row.datasource_id];
                  const status = testResult?.status ?? row.last_test_status;
                  const latency = testResult?.latency_ms ?? row.last_test_latency_ms;
                  const testedAt = testResult?.tested_at ?? row.last_test_time;
                  const message = testResult?.message ?? row.last_test_message;

                  return (
                    <tr
                      key={row.datasource_id}
                      className="sa-row-clickable"
                      onClick={() => openDrawerForDatasource(row)}
                    >
                      <td>{row.name}</td>
                      <td>{row.slug}</td>
                      <td>{row.type}</td>
                      <td>
                        <span className={row.is_active ? "badge text-bg-success" : "badge text-bg-secondary"}>
                          {row.is_active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <span className={statusBadgeClass(status)}>{status ?? "untested"}</span>
                          <small className="text-muted">
                            {latency != null ? `${Math.round(latency)}ms` : "-"}{" "}
                            {testedAt ? `· ${formatTimestamp(testedAt)}` : ""}
                          </small>
                          {message && <small className="text-muted">{message}</small>}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            aria-label={`Delete datasource ${row.name}`}
                            title={`Delete ${row.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(row);
                              setHardDelete(false);
                            }}
                          >
                            <i className="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!datasourcesQuery.isFetching && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No datasources found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isDrawerOpen && (
        <>
          <div className="sa-drawer-backdrop" onClick={closeDrawer} />
          <aside
            className="sa-drawer sa-datasource-drawer"
            role="dialog"
            aria-label={drawerDatasource ? `Edit datasource ${drawerDatasource.name}` : "Create datasource"}
          >
            <div className="sa-drawer-header">
              <h2>{drawerDatasource ? `Datasource • ${drawerDatasource.name}` : "Create Datasource"}</h2>
              <button
                type="button"
                className="btn btn-sm btn-light"
                aria-label="Close datasource drawer"
                onClick={closeDrawer}
              >
                <i className="fa fa-xmark" />
              </button>
            </div>
            <div className="sa-drawer-body">
              {drawerDatasource && (
                <div className="sa-drawer-form-card mb-3">
                  <h3 className="sa-drawer-form-card-title">Connection Test</h3>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className={statusBadgeClass(selectedTestResult?.status ?? drawerDatasource.last_test_status)}>
                      {(selectedTestResult?.status ?? drawerDatasource.last_test_status) ?? "untested"}
                    </span>
                    <small className="text-muted">
                      {(selectedTestResult?.latency_ms ?? drawerDatasource.last_test_latency_ms) != null
                        ? `${Math.round(selectedTestResult?.latency_ms ?? drawerDatasource.last_test_latency_ms ?? 0)}ms`
                        : "-"}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => runDatasourceTest(drawerDatasource)}
                    disabled={testDatasourceMutation.isPending}
                  >
                    {testDatasourceMutation.isPending ? "Testing..." : "Test Connection"}
                  </button>
                </div>
              )}

              <div className="sa-drawer-form-card mb-0">
                <h3 className="sa-drawer-form-card-title">{drawerDatasource ? "Edit Datasource" : "Datasource Details"}</h3>
                <div className="row g-3 mt-1 sa-datasource-drawer-form">
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Name</label>
                      <input
                        className="form-control"
                        value={formState.name}
                        onChange={(event) => {
                          const name = event.target.value;
                          setFormState((prev) => ({
                            ...prev,
                            name,
                            slug: drawerDatasource ? prev.slug : slugify(name),
                          }));
                        }}
                      />
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Slug</label>
                      <input
                        className="form-control"
                        value={formState.slug}
                        onChange={(event) => setFormState((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
                      />
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                          <label>Type</label>
                          <select
                            className="form-select"
                            value={formState.type}
                        onChange={(event) => handleDatasourceTypeChange(event.target.value)}
                      >
                        {DATASOURCE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Secret Ref</label>
                      <input
                        className="form-control"
                        value={formState.secret_ref}
                        onChange={(event) => setFormState((prev) => ({ ...prev, secret_ref: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>Description</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={formState.description}
                        onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </label>
                  </div>
                  {formState.type === "databricks" ? (
                    <>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Host</label>
                          <input
                            className="form-control"
                            value={formState.databricks.host}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                databricks: { ...prev.databricks, host: event.target.value },
                              }))
                            }
                            placeholder="https://adb-1234567890123456.7.azuredatabricks.net"
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>HTTP Path</label>
                          <input
                            className="form-control"
                            value={formState.databricks.http_path}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                databricks: { ...prev.databricks, http_path: event.target.value },
                              }))
                            }
                            placeholder="/sql/1.0/warehouses/abc123def4567890"
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Catalog</label>
                          <input
                            className="form-control"
                            value={formState.databricks.catalog}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                databricks: { ...prev.databricks, catalog: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Schema</label>
                          <input
                            className="form-control"
                            value={formState.databricks.schema}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                databricks: { ...prev.databricks, schema: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Authentication</label>
                          <select
                            className="form-select"
                            value={formState.databricks.auth_method}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                databricks: {
                                  ...prev.databricks,
                                  auth_method: event.target.value as DatabricksDatasourceFormState["auth_method"],
                                },
                              }))
                            }
                          >
                            <option value="token">Token</option>
                            <option value="oauth_client_credentials">OAuth Client Credentials</option>
                          </select>
                        </label>
                      </div>
                      {formState.databricks.auth_method === "token" && (
                        <div className="col-12">
                          <label className="sa-field mb-0">
                            <label>Token</label>
                            <input
                              className="form-control"
                              type="password"
                              value={formState.databricks.token}
                              placeholder={
                                formState.databricks.token_configured
                                  ? "Leave blank to keep the current token"
                                  : ""
                              }
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  databricks: {
                                    ...prev.databricks,
                                    token: event.target.value,
                                    token_configured:
                                      prev.databricks.token_configured || event.target.value.trim().length > 0,
                                  },
                                }))
                              }
                            />
                            {formState.databricks.token_configured && !formState.databricks.token.trim() && (
                              <small className="text-muted">A token is already configured.</small>
                            )}
                          </label>
                        </div>
                      )}
                      {formState.databricks.auth_method === "oauth_client_credentials" && (
                        <>
                          <div className="col-12">
                            <label className="sa-field mb-0">
                              <label>Client ID</label>
                              <input
                                className="form-control"
                                value={formState.databricks.client_id}
                                placeholder={
                                  formState.databricks.client_id_configured
                                    ? "Leave blank to keep the current client id"
                                    : ""
                                }
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    databricks: {
                                      ...prev.databricks,
                                      client_id: event.target.value,
                                      client_id_configured:
                                        prev.databricks.client_id_configured ||
                                        event.target.value.trim().length > 0,
                                    },
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="col-12">
                            <label className="sa-field mb-0">
                              <label>Client Secret</label>
                              <input
                                className="form-control"
                                type="password"
                                value={formState.databricks.client_secret}
                                placeholder={
                                  formState.databricks.client_secret_configured
                                    ? "Leave blank to keep the current client secret"
                                    : ""
                                }
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    databricks: {
                                      ...prev.databricks,
                                      client_secret: event.target.value,
                                      client_secret_configured:
                                        prev.databricks.client_secret_configured ||
                                        event.target.value.trim().length > 0,
                                    },
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="col-12">
                            <label className="sa-field mb-0">
                              <label>Token Path</label>
                              <input
                                className="form-control"
                                value={formState.databricks.token_path}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    databricks: { ...prev.databricks, token_path: event.target.value },
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="col-12">
                            <label className="sa-field mb-0">
                              <label>OAuth Scope</label>
                              <input
                                className="form-control"
                                value={formState.databricks.oauth_scope}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    databricks: { ...prev.databricks, oauth_scope: event.target.value },
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </>
                      )}
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Additional config_json</label>
                          <textarea
                            className="form-control font-monospace"
                            rows={6}
                            value={formState.databricks.extra_json_text}
                            onChange={(event) => {
                              setFormState((prev) => ({
                                ...prev,
                                databricks: { ...prev.databricks, extra_json_text: event.target.value },
                              }));
                              if (jsonError) setJsonError(null);
                            }}
                          />
                          <small className="text-muted d-block mt-1">
                            {getDatasourceConfigHelpText("databricks")}
                          </small>
                          {jsonError && <div className="error">{jsonError}</div>}
                        </label>
                      </div>
                    </>
                  ) : formState.type === "snowflake" ? (
                    <>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Account</label>
                          <input
                            className="form-control"
                            value={formState.snowflake.account}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: { ...prev.snowflake, account: event.target.value },
                              }))
                            }
                            placeholder="xy12345 or org-account.us-east-1"
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>User</label>
                          <input
                            className="form-control"
                            value={formState.snowflake.user}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: { ...prev.snowflake, user: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Database</label>
                          <input
                            className="form-control"
                            value={formState.snowflake.database}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: { ...prev.snowflake, database: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Warehouse</label>
                          <input
                            className="form-control"
                            value={formState.snowflake.warehouse}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: { ...prev.snowflake, warehouse: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Schema</label>
                          <input
                            className="form-control"
                            value={formState.snowflake.schema}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: { ...prev.snowflake, schema: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Role</label>
                          <input
                            className="form-control"
                            value={formState.snowflake.role}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: { ...prev.snowflake, role: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Authentication</label>
                          <select
                            className="form-select"
                            value={formState.snowflake.auth_method}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: {
                                  ...prev.snowflake,
                                  auth_method: event.target.value as SnowflakeDatasourceFormState["auth_method"],
                                },
                              }))
                            }
                          >
                            <option value="password">Password</option>
                            <option value="rsa_key">RSA Key</option>
                            <option value="externalbrowser">External Browser</option>
                          </select>
                        </label>
                      </div>
                      {formState.snowflake.auth_method === "password" && (
                        <div className="col-12">
                          <label className="sa-field mb-0">
                            <label>Password</label>
                            <input
                              className="form-control"
                              type="password"
                              value={formState.snowflake.password}
                              placeholder={
                                formState.snowflake.password_configured
                                  ? "Leave blank to keep the current password"
                                  : ""
                              }
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  snowflake: {
                                    ...prev.snowflake,
                                    password: event.target.value,
                                    password_configured:
                                      prev.snowflake.password_configured || event.target.value.trim().length > 0,
                                  },
                                }))
                              }
                            />
                            {formState.snowflake.password_configured && !formState.snowflake.password.trim() && (
                              <small className="text-muted">A password is already configured.</small>
                            )}
                          </label>
                        </div>
                      )}
                      {formState.snowflake.auth_method === "rsa_key" && (
                        <>
                          <div className="col-12">
                            <label className="sa-field mb-0">
                              <label>Private Key Upload</label>
                              <input
                                className="form-control"
                                type="file"
                                accept=".pem,.p8,.key,.txt"
                                onChange={(event) =>
                                  void handleSnowflakeKeyUpload(event.target.files?.[0] ?? null)
                                }
                              />
                            </label>
                          </div>
                          <div className="col-12">
                            <label className="sa-field mb-0">
                              <label>Private Key PEM</label>
                              <textarea
                                className="form-control font-monospace"
                                rows={8}
                                value={formState.snowflake.private_key_pem}
                                placeholder={
                                  formState.snowflake.private_key_pem_configured
                                    ? "Leave blank to keep the current private key"
                                    : "-----BEGIN PRIVATE KEY-----"
                                }
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    snowflake: {
                                      ...prev.snowflake,
                                      private_key_pem: event.target.value,
                                      private_key_pem_configured:
                                        prev.snowflake.private_key_pem_configured ||
                                        event.target.value.trim().length > 0,
                                    },
                                  }))
                                }
                              />
                              {formState.snowflake.private_key_pem_configured &&
                                !formState.snowflake.private_key_pem.trim() && (
                                  <small className="text-muted">A private key is already configured.</small>
                                )}
                            </label>
                          </div>
                          <div className="col-12">
                            <label className="sa-field mb-0">
                              <label>Private Key Passphrase</label>
                              <input
                                className="form-control"
                                type="password"
                                value={formState.snowflake.private_key_passphrase}
                                placeholder={
                                  formState.snowflake.private_key_passphrase_configured
                                    ? "Leave blank to keep the current passphrase"
                                    : ""
                                }
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    snowflake: {
                                      ...prev.snowflake,
                                      private_key_passphrase: event.target.value,
                                      private_key_passphrase_configured:
                                        prev.snowflake.private_key_passphrase_configured ||
                                        event.target.value.trim().length > 0,
                                    },
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </>
                      )}
                      <div className="col-12">
                        <label className="sa-field mb-0">
                          <label>Additional config_json</label>
                          <textarea
                            className="form-control font-monospace"
                            rows={6}
                            value={formState.snowflake.extra_json_text}
                            onChange={(event) => {
                              setFormState((prev) => ({
                                ...prev,
                                snowflake: { ...prev.snowflake, extra_json_text: event.target.value },
                              }));
                              if (jsonError) setJsonError(null);
                            }}
                          />
                          <small className="text-muted d-block mt-1">
                            {getDatasourceConfigHelpText("snowflake")}
                          </small>
                          {jsonError && <div className="error">{jsonError}</div>}
                        </label>
                      </div>
                    </>
                  ) : (
                  <div className="col-12">
                    <label className="sa-field mb-0">
                      <label>config_json</label>
                      <textarea
                        className="form-control font-monospace"
                        rows={10}
                        value={formState.config_json_text}
                        onChange={(event) => {
                          setFormState((prev) => ({ ...prev, config_json_text: event.target.value }));
                          if (jsonError) setJsonError(null);
                        }}
                      />
                      <small className="text-muted d-block mt-1">
                        {getDatasourceConfigHelpText(formState.type)}
                      </small>
                      {jsonError && <div className="error">{jsonError}</div>}
                    </label>
                  </div>
                  )}
                  <div className="col-12">
                    <label className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={formState.is_active}
                        onChange={(event) => setFormState((prev) => ({ ...prev, is_active: event.target.checked }))}
                      />
                      <span className="form-check-label">Active</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="sa-drawer-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={closeDrawer}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleSaveDatasource}
                disabled={createDatasourceMutation.isPending || updateDatasourceMutation.isPending}
              >
                Save
              </button>
            </div>
          </aside>
        </>
      )}

      {deleteTarget && (
        <div className="sa-dialog-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="sa-dialog" role="dialog" aria-label="Delete datasource" onClick={(event) => event.stopPropagation()}>
            <div className="sa-dialog-header">Delete Datasource</div>
            <div className="sa-dialog-body">
              <p className="mb-3">
                Delete <strong>{deleteTarget.name}</strong>?
              </p>
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={hardDelete}
                  onChange={(event) => setHardDelete(event.target.checked)}
                />
                <span className="form-check-label">Hard delete permanently</span>
              </label>
            </div>
            <div className="sa-dialog-footer">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleDeleteDatasource}
                disabled={deleteDatasourceMutation.isPending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
