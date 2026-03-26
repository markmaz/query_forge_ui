import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "react-toastify";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileUpdateRequest,
  Synonym,
  Acronym,
  DomainProfileMetricAgg,
  DomainProfileMetricConfigRow,
  DomainProfileMetricColumnOption,
  DomainProfileMetricKind,
  DomainTimePolicy,
  DomainCalendarMode,
  DomainWeekStart,
  DomainDefaultGrain,
} from "@/features/system-admin/types";
import {
  getDomainProfileMetrics,
  getDomainProfileMetricColumns,
  updateDomainProfileMetrics,
  getDomainTimePolicy,
  updateDomainTimePolicy,
} from "@/features/system-admin/api";
import TagInput from "./TagInput";
import SynonymEditor from "./SynonymEditor";
import AcronymEditor from "./AcronymEditor";

interface FormValues {
  domain_id: number;
  summary: string;
  keywords: string[];
  entities: string[];
  metrics: string[];
  attributes: string[];
  synonyms: Synonym[];
  acronyms: Acronym[];
  notes: string;
  embedding_text: string;
}

interface DomainProfileFormProps {
  profile?: DomainProfile | null;
  onSave: (data: DomainProfileCreateRequest | DomainProfileUpdateRequest) => void;
  onCancel: () => void;
  busy: boolean;
}

type MetricFormRow = DomainProfileMetricConfigRow & {
  ui_key: string;
};

const KIND_OPTIONS: DomainProfileMetricKind[] = ["count", "numeric", "ratio", "custom"];
const AGG_OPTIONS: DomainProfileMetricAgg[] = [
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
];
const COLUMN_KEY_PATTERN = /^wt\d+\.[a-z0-9_]+$/i;
const WEEK_START_OPTIONS: DomainWeekStart[] = ["monday", "sunday"];
const DEFAULT_GRAIN_OPTIONS: Exclude<DomainDefaultGrain, null>[] = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

type RelativeMapRow = {
  key: string;
  value: string;
};

function createDefaultTimePolicy(): DomainTimePolicy {
  return {
    calendar_mode: "calendar",
    fiscal_year_start_month: null,
    school_year_start_month: null,
    school_year_end_month: null,
    timezone: null,
    week_start: "monday",
    default_time_concept_key: null,
    allow_relative_ranges: true,
    default_grain: null,
    prefer_time_object_over_filter: true,
    strict_mode: false,
    relative_map: {},
    notes: null,
  };
}

function createEmptyMetricRow(): DomainProfileMetricConfigRow {
  return {
    metric_key: "",
    label: "",
    kind: "numeric",
    agg: "sum",
    column_key: null,
    sql_metric: null,
  };
}

function validateMetricRows(rows: DomainProfileMetricConfigRow[]): string[] {
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const rowNum = index + 1;
    const metricKey = row.metric_key?.trim() ?? "";
    const kind = row.kind;
    const agg = row.agg;
    const columnKey = row.column_key?.trim() ?? "";

    if (!metricKey) {
      errors.push(`Row ${rowNum}: metric_key is required.`);
    }
    if (!KIND_OPTIONS.includes(kind)) {
      errors.push(`Row ${rowNum}: kind must be one of ${KIND_OPTIONS.join(", ")}.`);
    }
    if (!AGG_OPTIONS.includes(agg)) {
      errors.push(`Row ${rowNum}: aggregation must be one of ${AGG_OPTIONS.join(", ")}.`);
    }
    if (columnKey && !COLUMN_KEY_PATTERN.test(columnKey)) {
      errors.push(`Row ${rowNum}: column_key must match wt<number>.<column_name>.`);
    }
  });
  return errors;
}

function validateTimePolicy(policy: DomainTimePolicy, rows: RelativeMapRow[]): string[] {
  const errors: string[] = [];

  if (policy.calendar_mode === "fiscal") {
    const month = policy.fiscal_year_start_month;
    if (!Number.isInteger(month) || Number(month) < 1 || Number(month) > 12) {
      errors.push("Fiscal year start month must be an integer between 1 and 12.");
    }
  }

  if (policy.calendar_mode === "school_year") {
    const startMonth = policy.school_year_start_month;
    const endMonth = policy.school_year_end_month;
    if (!Number.isInteger(startMonth) || Number(startMonth) < 1 || Number(startMonth) > 12) {
      errors.push("School year start month must be an integer between 1 and 12.");
    }
    if (!Number.isInteger(endMonth) || Number(endMonth) < 1 || Number(endMonth) > 12) {
      errors.push("School year end month must be an integer between 1 and 12.");
    }
  }

  rows.forEach((row, index) => {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key || !value) {
      errors.push(`Relative map row ${index + 1} requires non-empty key and value.`);
    }
  });

  return errors;
}

export default function DomainProfileForm({
  profile,
  onSave,
  onCancel,
  busy,
}: DomainProfileFormProps) {
  const isEdit = !!profile;
  const [embeddingOpen, setEmbeddingOpen] = useState(false);
  const [metricsRows, setMetricsRows] = useState<MetricFormRow[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricColumns, setMetricColumns] = useState<DomainProfileMetricColumnOption[]>([]);
  const [metricColumnsLoading, setMetricColumnsLoading] = useState(false);
  const [metricsSaving, setMetricsSaving] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsCanEdit, setMetricsCanEdit] = useState(true);
  const [metricsHasProfile, setMetricsHasProfile] = useState(false);
  const [timePolicy, setTimePolicy] = useState<DomainTimePolicy>(createDefaultTimePolicy());
  const [relativeMapRows, setRelativeMapRows] = useState<RelativeMapRow[]>([]);
  const [timePolicyLoading, setTimePolicyLoading] = useState(false);
  const [timePolicySaving, setTimePolicySaving] = useState(false);
  const [timePolicyError, setTimePolicyError] = useState<string | null>(null);
  const [timePolicyCanEdit, setTimePolicyCanEdit] = useState(true);
  const [timePolicyHasPolicy, setTimePolicyHasPolicy] = useState(false);
  const nextMetricRowId = useRef(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    defaultValues: {
      domain_id: profile?.domain_id ?? 0,
      summary: profile?.summary ?? "",
      keywords: profile?.keywords ?? [],
      entities: profile?.entities ?? [],
      metrics: profile?.metrics ?? [],
      attributes: profile?.attributes ?? [],
      synonyms: profile?.synonyms ?? [],
      acronyms: profile?.acronyms ?? [],
      notes: profile?.notes ?? "",
      embedding_text: profile?.embedding_text ?? "",
    },
  });
  const watchedDomainId = watch("domain_id");
  const activeDomainId = useMemo(() => {
    if (profile?.domain_id) return profile.domain_id;
    const parsed = Number(watchedDomainId);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }, [profile?.domain_id, watchedDomainId]);
  const metricColumnByKey = useMemo(
    () => new Map(metricColumns.map((column) => [column.column_key, column])),
    [metricColumns],
  );
  const selectedTimeColumn = timePolicy.default_time_concept_key
    ? metricColumnByKey.get(timePolicy.default_time_concept_key)
    : undefined;

  function attachMetricRowKey(row: DomainProfileMetricConfigRow): MetricFormRow {
    nextMetricRowId.current += 1;
    return {
      ...row,
      ui_key: `metric-row-${nextMetricRowId.current}`,
    };
  }

  useEffect(() => {
    let canceled = false;
    async function loadMetrics() {
      if (!activeDomainId) {
        setMetricsRows([]);
        setMetricsError(null);
        setMetricsCanEdit(true);
        setMetricsHasProfile(false);
        return;
      }

      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const response = await getDomainProfileMetrics(activeDomainId);
        if (canceled) return;
        setMetricsRows(response.metrics.map(attachMetricRowKey));
        setMetricsCanEdit(response.can_edit);
        setMetricsHasProfile(response.has_profile);
      } catch (error) {
        if (canceled) return;
        const message =
          error instanceof Error ? error.message : "Unable to load domain profile metrics.";
        setMetricsRows([]);
        setMetricsError(message);
      } finally {
        if (!canceled) setMetricsLoading(false);
      }
    }
    void loadMetrics();
    return () => {
      canceled = true;
    };
  }, [activeDomainId]);

  useEffect(() => {
    let canceled = false;
    async function loadMetricColumns() {
      if (!activeDomainId) {
        setMetricColumns([]);
        return;
      }

      setMetricColumnsLoading(true);
      try {
        const response = await getDomainProfileMetricColumns(activeDomainId);
        if (canceled) return;
        setMetricColumns(response);
      } catch (error) {
        if (canceled) return;
        const message = error instanceof Error ? error.message : "Unable to load domain columns.";
        setMetricColumns([]);
        setMetricsError((current) => current ?? message);
      } finally {
        if (!canceled) setMetricColumnsLoading(false);
      }
    }
    void loadMetricColumns();
    return () => {
      canceled = true;
    };
  }, [activeDomainId]);

  useEffect(() => {
    let canceled = false;
    async function loadTimePolicy() {
      if (!activeDomainId) {
        setTimePolicy(createDefaultTimePolicy());
        setRelativeMapRows([]);
        setTimePolicyError(null);
        setTimePolicyCanEdit(true);
        setTimePolicyHasPolicy(false);
        return;
      }

      setTimePolicyLoading(true);
      setTimePolicyError(null);
      try {
        const response = await getDomainTimePolicy(activeDomainId);
        if (canceled) return;
        setTimePolicy(response.policy);
        setRelativeMapRows(
          Object.entries(response.policy.relative_map ?? {}).map(([key, value]) => ({
            key,
            value,
          })),
        );
        setTimePolicyCanEdit(response.can_edit);
        setTimePolicyHasPolicy(response.has_policy);
      } catch (error) {
        if (canceled) return;
        const message =
          error instanceof Error ? error.message : "Unable to load domain time policy.";
        setTimePolicy(createDefaultTimePolicy());
        setRelativeMapRows([]);
        setTimePolicyError(message);
      } finally {
        if (!canceled) setTimePolicyLoading(false);
      }
    }
    void loadTimePolicy();
    return () => {
      canceled = true;
    };
  }, [activeDomainId]);

  function onSubmit(values: FormValues) {
    const clean = (arr: string[]) => (arr.length ? arr : undefined);
    const cleanObj = <T,>(arr: T[]) => (arr.length ? arr : undefined);
    const embeddingText =
      dirtyFields.embedding_text ? values.embedding_text || undefined : undefined;

    if (isEdit) {
      const body: DomainProfileUpdateRequest = {
        summary: values.summary || undefined,
        keywords: clean(values.keywords),
        entities: clean(values.entities),
        attributes: clean(values.attributes),
        synonyms: cleanObj(values.synonyms.filter((s) => s.term.trim())),
        acronyms: cleanObj(values.acronyms.filter((a) => a.abbr.trim())),
        notes: values.notes || undefined,
        embedding_text: embeddingText,
      };
      onSave(body);
    } else {
      const body: DomainProfileCreateRequest = {
        domain_id: Number(values.domain_id),
        summary: values.summary || undefined,
        keywords: clean(values.keywords),
        entities: clean(values.entities),
        metrics: clean(values.metrics),
        attributes: clean(values.attributes),
        synonyms: cleanObj(values.synonyms.filter((s) => s.term.trim())),
        acronyms: cleanObj(values.acronyms.filter((a) => a.abbr.trim())),
        notes: values.notes || undefined,
        embedding_text: embeddingText,
      };
      onSave(body);
    }
  }

  function updateMetricRow(
    index: number,
    field: "metric_key" | "label" | "kind" | "agg" | "column_key",
    value: string,
  ) {
    setMetricsRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (field === "column_key") {
          const trimmed = value.trim();
          return { ...row, column_key: trimmed.length > 0 ? trimmed : null };
        }
        if (field === "metric_key" || field === "label") {
          return { ...row, [field]: value };
        }
        if (field === "kind") {
          return { ...row, kind: value as DomainProfileMetricKind };
        }
        return { ...row, agg: value as DomainProfileMetricAgg };
      }),
    );
  }

  async function handleSaveMetrics() {
    if (!activeDomainId) {
      const message = "Select a valid domain id to save metric config.";
      setMetricsError(message);
      toast.error(message);
      return;
    }

    const validationErrors = validateMetricRows(metricsRows);
    if (validationErrors.length > 0) {
      const message = validationErrors.join(" ");
      setMetricsError(message);
      toast.error("Metric config validation failed.");
      return;
    }

    setMetricsSaving(true);
    setMetricsError(null);
    try {
      const normalizedRows = metricsRows.map((row) => ({
        metric_key: row.metric_key.trim(),
        label: row.label.trim(),
        kind: row.kind,
        agg: row.agg,
        column_key: row.column_key?.trim() ? row.column_key.trim() : null,
        sql_metric: buildMetricSqlMetric(row, metricColumnByKey.get(row.column_key?.trim() ?? "")),
      }));
      const response = await updateDomainProfileMetrics(activeDomainId, normalizedRows);
      setMetricsRows(response.metrics.map(attachMetricRowKey));
      setMetricsCanEdit(response.can_edit);
      setMetricsHasProfile(response.has_profile);
      toast.success("Domain profile metric config saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save domain profile metric config.";
      setMetricsError(message);
      toast.error(message);
    } finally {
      setMetricsSaving(false);
    }
  }

  function buildMetricSqlMetric(
    row: DomainProfileMetricConfigRow,
    selectedColumn?: DomainProfileMetricColumnOption,
  ): Record<string, unknown> | null {
    if (!selectedColumn) return row.sql_metric ?? null;
    return {
      fn: row.agg,
      label: row.label.trim() || row.metric_key.trim(),
      field: {
        modelColumnId: selectedColumn.model_column_id,
        columnName: selectedColumn.column_name,
        workspaceTableId: selectedColumn.workspace_table_id,
        exprId: null,
        alias: null,
      },
    };
  }

  function setTimePolicyField<K extends keyof DomainTimePolicy>(
    field: K,
    value: DomainTimePolicy[K],
  ) {
    setTimePolicy((prev) => ({ ...prev, [field]: value }));
  }

  function updateRelativeMapRow(index: number, field: keyof RelativeMapRow, value: string) {
    setRelativeMapRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  }

  async function handleSaveTimePolicy() {
    if (!activeDomainId) {
      const message = "Select a valid domain id to save time policy.";
      setTimePolicyError(message);
      toast.error(message);
      return;
    }

    const validationErrors = validateTimePolicy(timePolicy, relativeMapRows);
    if (validationErrors.length > 0) {
      const message = validationErrors.join(" ");
      setTimePolicyError(message);
      toast.error("Time policy validation failed.");
      return;
    }

    const relative_map: Record<string, string> = {};
    relativeMapRows.forEach((row) => {
      const key = row.key.trim();
      const value = row.value.trim();
      if (key && value) {
        relative_map[key] = value;
      }
    });

    const payload: DomainTimePolicy = {
      ...timePolicy,
      fiscal_year_start_month:
        timePolicy.calendar_mode === "fiscal"
          ? timePolicy.fiscal_year_start_month
          : null,
      school_year_start_month:
        timePolicy.calendar_mode === "school_year"
          ? timePolicy.school_year_start_month
          : null,
      school_year_end_month:
        timePolicy.calendar_mode === "school_year"
          ? timePolicy.school_year_end_month
          : null,
      timezone: timePolicy.timezone?.trim() ? timePolicy.timezone.trim() : null,
      default_time_concept_key: timePolicy.default_time_concept_key?.trim()
        ? timePolicy.default_time_concept_key.trim()
        : null,
      notes: timePolicy.notes?.trim() ? timePolicy.notes.trim() : null,
      relative_map,
    };

    setTimePolicySaving(true);
    setTimePolicyError(null);
    try {
      const response = await updateDomainTimePolicy(activeDomainId, payload);
      setTimePolicy(response.policy);
      setRelativeMapRows(
        Object.entries(response.policy.relative_map ?? {}).map(([key, value]) => ({
          key,
          value,
        })),
      );
      setTimePolicyCanEdit(response.can_edit);
      setTimePolicyHasPolicy(response.has_policy);
      toast.success("Domain time policy saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save domain time policy.";
      setTimePolicyError(message);
      toast.error(message);
    } finally {
      setTimePolicySaving(false);
    }
  }

  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onCancel} />
      <div className="sa-drawer sa-domain-profile-drawer">
        <div className="sa-drawer-header">
          <h2>{isEdit ? "Edit Domain Profile" : "Create Domain Profile"}</h2>
          <button type="button" className="btn btn-sm btn-light" onClick={onCancel}>
            <i className="fa fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="sa-drawer-body">
          <div className="sa-field">
            <label>Domain ID</label>
            <input
              type="number"
              className="form-control form-control-sm"
              disabled={isEdit}
              {...register("domain_id", {
                required: !isEdit && "Domain ID is required",
                min: { value: 1, message: "Must be greater than 0" },
                valueAsNumber: true,
              })}
            />
            {errors.domain_id && <div className="error">{errors.domain_id.message}</div>}
          </div>

          <div className="sa-field">
            <label>Summary</label>
            <textarea
              className="form-control form-control-sm"
              rows={3}
              {...register("summary", { required: "Summary is required" })}
            />
            {errors.summary && <div className="error">{errors.summary.message}</div>}
          </div>

          <div className="sa-field">
            <label>Keywords</label>
            <Controller
              name="keywords"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add keywords…" />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Entities</label>
            <Controller
              name="entities"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add entities…" />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Metrics</label>
            <Controller
              name="metrics"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add metrics…" />
              )}
            />
          </div>

          <div className="sa-drawer-form-card">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div>
                <h4 className="sa-drawer-form-card-title mb-1">Profile Metric Configuration</h4>
                <div className="sa-field hint mb-0">
                  Configure metric_key, kind, aggregation, and column binding for profile generation.
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setMetricsRows((prev) => [...prev, attachMetricRowKey(createEmptyMetricRow())])}
                  data-testid="add-metric-row-btn"
                  disabled={!activeDomainId || metricsLoading || busy || metricsSaving || !metricsCanEdit}
                >
                  <i className="fa fa-plus me-1" />
                  Add Row
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => void handleSaveMetrics()}
                  data-testid="save-metrics-btn"
                  disabled={!activeDomainId || metricsLoading || busy || metricsSaving || !metricsCanEdit}
                >
                  {metricsSaving && <span className="sa-spinner" style={{ marginRight: 6 }} />}
                  Save Metrics
                </button>
              </div>
            </div>

            {!metricsCanEdit && (
              <div className="alert alert-warning py-2 px-3 mb-2" role="alert">
                Metric configuration is read-only for this domain profile.
              </div>
            )}
            {!metricsHasProfile && activeDomainId && (
              <div className="alert alert-info py-2 px-3 mb-2" role="alert">
                No domain profile row exists yet. Saving metrics will create it.
              </div>
            )}
            {metricsError && (
              <div className="alert alert-danger py-2 px-3 mb-2" role="alert">
                {metricsError}
              </div>
            )}

            {metricsLoading ? (
              <div className="text-muted small d-inline-flex align-items-center gap-2 py-2">
                <span className="sa-spinner" />
                Loading metric configuration...
              </div>
            ) : (
              <div className="sa-table-wrap mb-0">
                <table className="sa-table sa-table-nested">
                  <thead>
                    <tr>
                      <th>Metric Key</th>
                      <th>Label</th>
                      <th>Kind</th>
                      <th>Aggregation</th>
                      <th>Column</th>
                      <th style={{ width: 58 }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsRows.map((row, index) => (
                      <tr key={row.ui_key}>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={row.metric_key}
                            data-testid={`metric-key-${index}`}
                            onChange={(event) => updateMetricRow(index, "metric_key", event.target.value)}
                            disabled={!metricsCanEdit || metricsSaving || busy}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={row.label}
                            data-testid={`metric-label-${index}`}
                            onChange={(event) => updateMetricRow(index, "label", event.target.value)}
                            disabled={!metricsCanEdit || metricsSaving || busy}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={row.kind}
                            data-testid={`metric-kind-${index}`}
                            onChange={(event) => updateMetricRow(index, "kind", event.target.value)}
                            disabled={!metricsCanEdit || metricsSaving || busy}
                          >
                            {KIND_OPTIONS.map((kind) => (
                              <option key={kind} value={kind}>
                                {kind}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={row.agg}
                            data-testid={`metric-agg-${index}`}
                            onChange={(event) => updateMetricRow(index, "agg", event.target.value)}
                            disabled={!metricsCanEdit || metricsSaving || busy}
                          >
                            {AGG_OPTIONS.map((agg) => (
                              <option key={agg} value={agg}>
                                {agg}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={row.column_key ?? ""}
                            data-testid={`metric-column-key-${index}`}
                            onChange={(event) => updateMetricRow(index, "column_key", event.target.value)}
                            disabled={!metricsCanEdit || metricsSaving || busy || metricColumnsLoading}
                          >
                            <option value="">
                              {metricColumnsLoading ? "Loading domain columns..." : "Select a domain column"}
                            </option>
                            {row.column_key &&
                              !metricColumnByKey.has(row.column_key) && (
                                <option value={row.column_key}>{`${row.column_key} (unavailable)`}</option>
                              )}
                            {metricColumns.map((column) => (
                              <option key={column.column_key} value={column.column_key}>
                                {column.display_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              setMetricsRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                            }
                            disabled={!metricsCanEdit || metricsSaving || busy}
                            aria-label={`Remove metric row ${index + 1}`}
                          >
                            <i className="fa fa-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {metricsRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-3">
                          No metrics configured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="sa-drawer-form-card">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div>
                <h4 className="sa-drawer-form-card-title mb-1">Time Policy</h4>
                <div className="sa-field hint mb-0">
                  Configure default time handling, grains, and relative range mapping for this domain.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                data-testid="save-time-policy-btn"
                onClick={() => void handleSaveTimePolicy()}
                disabled={!activeDomainId || busy || timePolicyLoading || timePolicySaving || !timePolicyCanEdit}
              >
                {timePolicySaving && <span className="sa-spinner" style={{ marginRight: 6 }} />}
                Save Time Policy
              </button>
            </div>

            {!timePolicyCanEdit && (
              <div className="alert alert-warning py-2 px-3 mb-2" role="alert">
                Time policy is read-only for this domain profile.
              </div>
            )}
            {!timePolicyHasPolicy && activeDomainId && (
              <div className="alert alert-info py-2 px-3 mb-2" role="alert">
                No time policy exists yet. Saving will create one for this domain.
              </div>
            )}
            {timePolicyError && (
              <div className="alert alert-danger py-2 px-3 mb-2" role="alert">
                {timePolicyError}
              </div>
            )}

            {timePolicyLoading ? (
              <div className="text-muted small d-inline-flex align-items-center gap-2 py-2">
                <span className="sa-spinner" />
                Loading time policy...
              </div>
            ) : (
              <>
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label">Calendar Mode</label>
                    <select
                      className="form-select form-select-sm"
                      value={timePolicy.calendar_mode}
                      data-testid="time-policy-calendar-mode"
                      onChange={(event) => {
                        const calendarMode = event.target.value as DomainCalendarMode;
                        setTimePolicy((prev) => ({
                          ...prev,
                          calendar_mode: calendarMode,
                          fiscal_year_start_month:
                            calendarMode === "fiscal" ? prev.fiscal_year_start_month ?? 1 : null,
                          school_year_start_month:
                            calendarMode === "school_year" ? prev.school_year_start_month ?? 8 : null,
                          school_year_end_month:
                            calendarMode === "school_year" ? prev.school_year_end_month ?? 7 : null,
                        }));
                      }}
                      disabled={!timePolicyCanEdit || timePolicySaving || busy}
                    >
                      <option value="calendar">calendar</option>
                      <option value="fiscal">fiscal</option>
                      <option value="school_year">school_year</option>
                    </select>
                  </div>

                  {timePolicy.calendar_mode === "fiscal" && (
                    <div className="col-12 col-md-4">
                      <label className="form-label">Fiscal Year Start Month</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        className="form-control form-control-sm"
                        data-testid="time-policy-fiscal-month"
                        value={timePolicy.fiscal_year_start_month ?? ""}
                        onChange={(event) => {
                          const value = event.target.value.trim();
                          setTimePolicyField(
                            "fiscal_year_start_month",
                            value === "" ? null : Number(value),
                          );
                        }}
                        disabled={!timePolicyCanEdit || timePolicySaving || busy}
                      />
                    </div>
                  )}

                  {timePolicy.calendar_mode === "school_year" && (
                    <>
                      <div className="col-12 col-md-4">
                        <label className="form-label">School Year Start Month</label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="form-control form-control-sm"
                          data-testid="time-policy-school-year-start-month"
                          value={timePolicy.school_year_start_month ?? ""}
                          onChange={(event) => {
                            const value = event.target.value.trim();
                            setTimePolicyField(
                              "school_year_start_month",
                              value === "" ? null : Number(value),
                            );
                          }}
                          disabled={!timePolicyCanEdit || timePolicySaving || busy}
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">School Year End Month</label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="form-control form-control-sm"
                          data-testid="time-policy-school-year-end-month"
                          value={timePolicy.school_year_end_month ?? ""}
                          onChange={(event) => {
                            const value = event.target.value.trim();
                            setTimePolicyField(
                              "school_year_end_month",
                              value === "" ? null : Number(value),
                            );
                          }}
                          disabled={!timePolicyCanEdit || timePolicySaving || busy}
                        />
                      </div>
                    </>
                  )}

                  <div className="col-12 col-md-4">
                    <label className="form-label">Timezone</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      data-testid="time-policy-timezone"
                      value={timePolicy.timezone ?? ""}
                      onChange={(event) => setTimePolicyField("timezone", event.target.value)}
                      disabled={!timePolicyCanEdit || timePolicySaving || busy}
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label">Week Start</label>
                    <select
                      className="form-select form-select-sm"
                      data-testid="time-policy-week-start"
                      value={timePolicy.week_start}
                      onChange={(event) =>
                        setTimePolicyField("week_start", event.target.value as DomainWeekStart)
                      }
                      disabled={!timePolicyCanEdit || timePolicySaving || busy}
                    >
                      {WEEK_START_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label">Default Grain</label>
                    <select
                      className="form-select form-select-sm"
                      data-testid="time-policy-default-grain"
                      value={timePolicy.default_grain ?? ""}
                      onChange={(event) =>
                        setTimePolicyField(
                          "default_grain",
                          event.target.value
                            ? (event.target.value as Exclude<DomainDefaultGrain, null>)
                            : null,
                        )
                      }
                      disabled={!timePolicyCanEdit || timePolicySaving || busy}
                    >
                      <option value="">(none)</option>
                      {DEFAULT_GRAIN_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label" htmlFor="time-policy-default-column">
                      Default Time Column
                    </label>
                    <select
                      id="time-policy-default-column"
                      className="form-select form-select-sm"
                      data-testid="time-policy-default-column"
                      value={timePolicy.default_time_concept_key ?? ""}
                      onChange={(event) =>
                        setTimePolicyField(
                          "default_time_concept_key",
                          event.target.value.trim() ? event.target.value : null,
                        )
                      }
                      disabled={
                        !timePolicyCanEdit || timePolicySaving || busy || metricColumnsLoading
                      }
                    >
                      <option value="">
                        {metricColumnsLoading ? "Loading domain columns..." : "(none)"}
                      </option>
                      {timePolicy.default_time_concept_key &&
                        !selectedTimeColumn && (
                          <option value={timePolicy.default_time_concept_key}>
                            {`${timePolicy.default_time_concept_key} (unavailable)`}
                          </option>
                        )}
                      {metricColumns.map((column) => (
                        <option key={column.column_key} value={column.column_key}>
                          {column.display_name}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">
                      Uses the selected domain column key when the planner needs a default time field.
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                  <label className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      data-testid="time-policy-allow-relative"
                      checked={timePolicy.allow_relative_ranges}
                      onChange={(event) =>
                        setTimePolicyField("allow_relative_ranges", event.target.checked)
                      }
                      disabled={!timePolicyCanEdit || timePolicySaving || busy}
                    />
                    <span className="form-check-label">Allow relative ranges</span>
                  </label>
                  <label className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      data-testid="time-policy-prefer-time-object"
                      checked={timePolicy.prefer_time_object_over_filter}
                      onChange={(event) =>
                        setTimePolicyField("prefer_time_object_over_filter", event.target.checked)
                      }
                      disabled={!timePolicyCanEdit || timePolicySaving || busy}
                    />
                    <span className="form-check-label">Prefer time object over filter</span>
                  </label>
                  <label className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      data-testid="time-policy-strict-mode"
                      checked={timePolicy.strict_mode}
                      onChange={(event) => setTimePolicyField("strict_mode", event.target.checked)}
                      disabled={!timePolicyCanEdit || timePolicySaving || busy}
                    />
                    <span className="form-check-label">Strict mode</span>
                  </label>
                </div>

                <div className="sa-table-wrap mt-3 mb-2">
                  <table className="sa-table sa-table-nested">
                    <thead>
                      <tr>
                        <th>Relative Key</th>
                        <th>Mapped Value</th>
                        <th style={{ width: 58 }}>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relativeMapRows.map((row, index) => (
                        <tr key={`relative-map-row-${index}`}>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              data-testid={`time-policy-relative-key-${index}`}
                              value={row.key}
                              onChange={(event) =>
                                updateRelativeMapRow(index, "key", event.target.value)
                              }
                              disabled={!timePolicyCanEdit || timePolicySaving || busy}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              data-testid={`time-policy-relative-value-${index}`}
                              value={row.value}
                              onChange={(event) =>
                                updateRelativeMapRow(index, "value", event.target.value)
                              }
                              disabled={!timePolicyCanEdit || timePolicySaving || busy}
                            />
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                setRelativeMapRows((prev) =>
                                  prev.filter((_, rowIndex) => rowIndex !== index),
                                )
                              }
                              disabled={!timePolicyCanEdit || timePolicySaving || busy}
                              aria-label={`Remove relative map row ${index + 1}`}
                            >
                              <i className="fa fa-trash" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {relativeMapRows.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center text-muted py-3">
                            No relative map entries configured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary mb-3"
                  data-testid="add-time-policy-relative-row-btn"
                  onClick={() =>
                    setRelativeMapRows((prev) => [...prev, { key: "", value: "" }])
                  }
                  disabled={!timePolicyCanEdit || timePolicySaving || busy}
                >
                  <i className="fa fa-plus me-1" />
                  Add Relative Map Row
                </button>

                <div className="sa-field mb-0">
                  <label>Notes</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    data-testid="time-policy-notes"
                    value={timePolicy.notes ?? ""}
                    onChange={(event) => setTimePolicyField("notes", event.target.value)}
                    disabled={!timePolicyCanEdit || timePolicySaving || busy}
                  />
                </div>
              </>
            )}
          </div>

          <div className="sa-field">
            <label>Attributes</label>
            <Controller
              name="attributes"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add attributes…" />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Synonyms</label>
            <Controller
              name="synonyms"
              control={control}
              render={({ field }) => (
                <SynonymEditor value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Acronyms</label>
            <Controller
              name="acronyms"
              control={control}
              render={({ field }) => (
                <AcronymEditor value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Notes</label>
            <textarea
              className="form-control form-control-sm"
              rows={3}
              {...register("notes")}
            />
          </div>

          <div className="sa-field">
            <button
              type="button"
              className="sa-collapsible-toggle"
              onClick={() => setEmbeddingOpen(!embeddingOpen)}
            >
              <i className={`fa fa-chevron-${embeddingOpen ? "down" : "right"}`} />{" "}
              Embedding Text
            </button>
            {embeddingOpen && (
              <>
                <textarea
                  className="form-control form-control-sm mt-1"
                  rows={4}
                  {...register("embedding_text")}
                />
                <div className="hint">Auto-generated if left empty</div>
              </>
            )}
          </div>

          {isEdit && profile?.content_hash && (
            <div className="sa-field">
              <label>Content Hash</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={profile.content_hash}
                readOnly
              />
            </div>
          )}

          <div className="sa-drawer-footer" style={{ padding: 0, border: "none", marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
              {busy && <span className="sa-spinner" style={{ marginRight: 6 }} />}
              {isEdit ? "Save Changes" : "Create Profile"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
