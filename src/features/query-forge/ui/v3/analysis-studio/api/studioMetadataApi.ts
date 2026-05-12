import api from "../../../../../../shared/services/api";
import type {
  StudioDomainExplorer,
  StudioDomainSummary,
  StudioField,
  StudioFieldCategory,
} from "../model/analysisTypes";

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeDomainSummary(raw: unknown): StudioDomainSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const id = toNumber(row.id);
  const key = asString(row.key);
  const label = asString(row.label || row.name);
  if (id === null || !label) return null;

  return {
    id,
    key: key || label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    label,
    kind: asString(row.kind || row.domain_kind) || undefined,
    description: asString(row.description) || undefined,
    fieldCount: toNumber(row.fieldCount ?? row.field_count) ?? undefined,
    categoryCount: toNumber(row.categoryCount ?? row.category_count) ?? undefined,
    metricCount: toNumber(row.metricCount ?? row.metric_count) ?? undefined,
  };
}

function normalizeField(raw: unknown): StudioField | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const key = asString(row.key || row.column_name);
  const label = asString(row.label || row.name || key);
  const path = asString(row.path);
  const id = row.id ?? path;
  if (!key || !label || !path) return null;

  const aliases = Array.isArray(row.aliases)
    ? row.aliases.map((alias) => asString(alias)).filter(Boolean)
    : [];
  const allowedAggregations = Array.isArray(row.allowedAggregations)
    ? row.allowedAggregations.map((agg) => asString(agg).toLowerCase()).filter(Boolean)
    : [];

  return {
    id: typeof id === "number" ? id : asString(id),
    key,
    label,
    path,
    dataType: asString(row.dataType || row.data_type) || undefined,
    aliases,
    allowedAggregations,
  };
}

function normalizeCategory(raw: unknown): StudioFieldCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const label = asString(row.label);
  if (!id || !label) return null;

  const fields = Array.isArray(row.fields)
    ? row.fields.map(normalizeField).filter((field): field is StudioField => Boolean(field))
    : [];

  return { id, label, fields };
}

function normalizeExplorer(raw: unknown): StudioDomainExplorer {
  const empty: StudioDomainExplorer = {
    domain: {
      id: 0,
      key: "",
      label: "",
      description: undefined,
      fieldCount: 0,
      categoryCount: 0,
      metricCount: 0,
      exampleQuestions: [],
    },
    recommendedFields: [],
    fieldCategories: [],
  };

  if (!raw || typeof raw !== "object") return empty;
  const row = raw as Record<string, unknown>;

  const domain = normalizeDomainSummary(row.domain);
  if (!domain) return empty;

  const domainDetails = {
    ...domain,
    exampleQuestions: Array.isArray((row.domain as Record<string, unknown>)?.exampleQuestions)
      ? ((row.domain as Record<string, unknown>).exampleQuestions as unknown[])
        .map((question) => asString(question))
        .filter(Boolean)
      : [],
  };

  const recommendedFields = Array.isArray(row.recommendedFields)
    ? row.recommendedFields.map(normalizeField).filter((field): field is StudioField => Boolean(field))
    : [];

  const fieldCategories = Array.isArray(row.fieldCategories)
    ? row.fieldCategories.map(normalizeCategory).filter((category): category is StudioFieldCategory => Boolean(category))
    : [];

  return {
    domain: domainDetails,
    recommendedFields,
    fieldCategories,
  };
}

export async function listStudioDomains(): Promise<StudioDomainSummary[]> {
  const response = await api.get("/query-studio/domains");
  const payload = response.data;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
      ? payload.rows
      : [];

  return rows
    .map(normalizeDomainSummary)
    .filter((row: StudioDomainSummary | null): row is StudioDomainSummary => Boolean(row));
}

export async function getStudioDomainExplorer(domainId: number): Promise<StudioDomainExplorer> {
  const response = await api.get(`/query-studio/domains/${domainId}/explorer`);
  return normalizeExplorer(response.data);
}
