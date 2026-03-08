import api from "@/shared/services/api";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileUpdateRequest,
  DomainProfileListResponse,
  DomainProfileDeleteResponse,
} from "../types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function toTagLabel(value: unknown): string | null {
  const primitive = asString(value);
  if (primitive) return primitive;

  const record = asRecord(value);
  if (!record) return null;

  const label =
    asString(record.label) ??
    asString(record.metric_key) ??
    asString(record.column_key) ??
    asString(record.sql_metric) ??
    asString(record.name) ??
    asString(record.term) ??
    asString(record.key) ??
    asString(record.value);
  if (label) return label;

  const agg = asString(record.agg);
  const columnKey = asString(record.column_key);
  if (agg && columnKey) return `${agg}(${columnKey})`;

  return null;
}

function toTagArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tags = value.map(toTagLabel).filter((entry): entry is string => Boolean(entry));
  return tags.length > 0 ? tags : [];
}

function normalizeDomainProfile(raw: unknown): DomainProfile {
  const row = asRecord(raw) ?? {};

  const synonymsRaw = Array.isArray(row.synonyms) ? row.synonyms : [];
  const acronymsRaw = Array.isArray(row.acronyms) ? row.acronyms : [];

  return {
    id: Number(row.id ?? 0),
    workspace_id: asString(row.workspace_id) ?? "",
    domain_id: Number(row.domain_id ?? 0),
    summary: asString(row.summary),
    keywords: toTagArray(row.keywords),
    entities: toTagArray(row.entities),
    metrics: toTagArray(row.metrics),
    attributes: toTagArray(row.attributes),
    synonyms: synonymsRaw
      .map((item) => {
        const s = asRecord(item);
        if (!s) return null;
        const term = asString(s.term) ?? "";
        const means = Array.isArray(s.means)
          ? s.means.map((m) => asString(m)).filter((m): m is string => Boolean(m))
          : [];
        return term ? { term, means } : null;
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    acronyms: acronymsRaw
      .map((item) => {
        const a = asRecord(item);
        if (!a) return null;
        const abbr = asString(a.abbr) ?? "";
        const expansion = asString(a.expansion) ?? "";
        return abbr && expansion ? { abbr, expansion } : null;
      })
      .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    notes: asString(row.notes),
    embedding_text: asString(row.embedding_text),
    content_hash: asString(row.content_hash),
    embedding_model: asString(row.embedding_model),
    embedded_at: asString(row.embedded_at),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    domain_name: asString(row.domain_name),
  };
}

export async function listDomainProfiles(): Promise<DomainProfileListResponse> {
  const { data } = await api.get<DomainProfileListResponse>(
    "/admin/domain-profiles"
  );
  const rows = Array.isArray((data as any)?.profiles)
    ? (data as any).profiles
    : Array.isArray((data as any)?.rows)
      ? (data as any).rows
      : [];
  return {
    profiles: rows.map(normalizeDomainProfile),
    count: Number((data as any)?.count ?? rows.length),
  };
}

export async function getDomainProfile(
  domainId: number
): Promise<DomainProfile> {
  const { data } = await api.get<DomainProfile>(
    `/admin/domain-profiles/${domainId}`
  );
  return normalizeDomainProfile(data);
}

export async function createDomainProfile(
  body: DomainProfileCreateRequest
): Promise<DomainProfile> {
  const { data } = await api.post<DomainProfile>(
    "/admin/domain-profiles",
    body
  );
  return normalizeDomainProfile(data);
}

export async function updateDomainProfile(
  domainId: number,
  body: DomainProfileUpdateRequest
): Promise<DomainProfile> {
  const { data } = await api.put<DomainProfile>(
    `/admin/domain-profiles/${domainId}`,
    body
  );
  return normalizeDomainProfile(data);
}

export async function deleteDomainProfile(
  domainId: number
): Promise<DomainProfileDeleteResponse> {
  const { data } = await api.delete<DomainProfileDeleteResponse>(
    `/admin/domain-profiles/${domainId}`
  );
  return data;
}
