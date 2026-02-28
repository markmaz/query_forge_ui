import React, { useMemo, useState } from "react";
import type {
  AiSuggestion,
  PlanDomainExplanation,
  PlanDomainResponse,
  PlannerResultMetadata,
} from "../types";

const FALLBACK_SUMMARY = "We built this query based on your request and available data.";

function formatScalarValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatFilterClause(filter: {
  label?: string | null;
  op_label?: string | null;
  value?: unknown;
  values?: unknown[];
}): string {
  const label = (filter.label ?? "").trim();
  const operator = (filter.op_label ?? "").trim();
  const values = Array.isArray(filter.values) ? filter.values : [];
  const valueText = formatScalarValue(filter.value).trim();

  if (values.length > 0) {
    const listText = values.map((entry) => formatScalarValue(entry)).filter(Boolean).join(", ");
    const prefix = [label, operator].filter(Boolean).join(" ").trim();
    return [prefix, listText ? `(${listText})` : ""].filter(Boolean).join(" ").trim();
  }

  return [label, operator, valueText].filter(Boolean).join(" ").trim();
}

export type PlanExplanationProps = {
  response?: PlanDomainResponse | null;
  plannerMeta?: PlannerResultMetadata | null;
  explanation?: PlanDomainExplanation | null;
  confidence?: AiSuggestion["confidence"] | null;
  onApplyChanges?: (() => void) | null;
  canApply?: boolean;
};

export const PlanExplanation: React.FC<PlanExplanationProps> = ({
  response,
  plannerMeta,
  explanation,
  confidence,
  onApplyChanges,
  canApply = true,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const resolvedExplanation = explanation ?? response?.explanation ?? plannerMeta?.explanation ?? null;
  if (!resolvedExplanation) return null;

  const summary = resolvedExplanation.summary?.trim() || FALLBACK_SUMMARY;

  const domainName =
    resolvedExplanation.domain?.selected_domain_name?.trim() ||
    (plannerMeta?.planJsonV2.domain_name ?? "").trim() ||
    "";
  const domainReason = resolvedExplanation.domain?.reason?.trim() || "";

  const dimensions = useMemo(
    () => (resolvedExplanation.dimensions ?? []).filter((item) => (item.label ?? "").trim()),
    [resolvedExplanation.dimensions]
  );

  const metrics = useMemo(
    () => (resolvedExplanation.metrics ?? []).filter((item) => (item.label ?? "").trim()),
    [resolvedExplanation.metrics]
  );

  const filters = useMemo(
    () => (resolvedExplanation.filters ?? []).filter((item) => formatFilterClause(item).trim()),
    [resolvedExplanation.filters]
  );
  const formattedFilters = useMemo(
    () =>
      filters.map((item) => ({
        ...item,
        clause: formatFilterClause(item),
      })),
    [filters]
  );

  const technicalDomainEntries = useMemo(() => {
    const domain = resolvedExplanation.domain ?? {};
    return Object.entries(domain).filter(
      ([key, value]) =>
        key !== "selected_domain_name" &&
        key !== "reason" &&
        value != null &&
        (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    );
  }, [resolvedExplanation.domain]);

  const hasTechnicalDetails =
    technicalDomainEntries.length > 0 ||
    dimensions.some((item) => (item.column_key ?? "").trim()) ||
    metrics.some((item) => item.metric_ref != null) ||
    formattedFilters.some((item) => (item.column_key ?? "").trim()) ||
    (plannerMeta?.planJsonV2.base_domain_id ?? response?.plan_json_v2?.base_domain_id) != null;

  return (
    <section className="ncqv2-ai-plan-explanation" aria-label="Why this answer">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div className="fw-semibold">Why this answer</div>
        {confidence ? (
          <span className={`badge ncqv2-ai-confidence ncqv2-ai-confidence-${confidence}`}>
            {confidence}
          </span>
        ) : null}
      </div>

      <div className="ncqv2-ai-plan-summary mt-2">{summary}</div>

      <div className="d-flex align-items-center justify-content-between mt-3">
        <div className="fw-semibold small">Details</div>
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-decoration-none"
          onClick={() => setDetailsOpen((prev) => !prev)}
        >
          {detailsOpen ? "See less" : "See more"}
        </button>
      </div>

      {detailsOpen ? (
        <div className="mt-2">
          {domainName || domainReason ? (
            <div className="mt-1">
              <div className="fw-semibold small">Domain chosen</div>
              {domainName ? <div className="small mt-1">{domainName}</div> : null}
              {domainReason ? <div className="small text-muted mt-1">{domainReason}</div> : null}
            </div>
          ) : null}

          {dimensions.length > 0 ? (
            <div className="mt-3">
              <div className="fw-semibold small">Fields included</div>
              <ul className="mb-0 mt-1 ps-3">
                {dimensions.map((item, idx) => (
                  <li key={`dimension-${idx}`} className="small mb-1">
                    <span className="fw-semibold">{item.label}</span>
                    {item.reason ? <span className="text-muted"> - {item.reason}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {formattedFilters.length > 0 ? (
            <div className="mt-3">
              <div className="fw-semibold small">Filters applied</div>
              <ul className="mb-0 mt-1 ps-3">
                {formattedFilters.map((item, idx) => (
                  <li key={`filter-${idx}`} className="small mb-1">
                    <span className="fw-semibold">{item.clause}</span>
                    {item.reason ? <span className="text-muted"> - {item.reason}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {metrics.length > 0 ? (
            <div className="mt-3">
              <div className="fw-semibold small">Metrics used</div>
              <ul className="mb-0 mt-1 ps-3">
                {metrics.map((item, idx) => (
                  <li key={`metric-${idx}`} className="small mb-1">
                    <span className="fw-semibold">{item.label}</span>
                    {item.reason ? <span className="text-muted"> - {item.reason}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasTechnicalDetails ? (
            <details
              className="mt-3"
              onToggle={(event) =>
                setTechnicalOpen((event.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className="small fw-semibold">Technical details</summary>
              {technicalOpen ? (
                <div className="small mt-2">
                  <div>
                    Base domain id:{" "}
                    <code>
                      {plannerMeta?.planJsonV2.base_domain_id ??
                        response?.plan_json_v2?.base_domain_id ??
                        "n/a"}
                    </code>
                  </div>

                  {technicalDomainEntries.length > 0 ? (
                    <div className="mt-2">
                      <div className="text-muted">Domain metadata</div>
                      <ul className="mb-0 ps-3">
                        {technicalDomainEntries.map(([key, value]) => (
                          <li key={`domain-meta-${key}`}>
                            <code>{key}</code>: <code>{String(value)}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {dimensions.some((item) => (item.column_key ?? "").trim()) ? (
                    <div className="mt-2">
                      <div className="text-muted">Dimension columns</div>
                      <ul className="mb-0 ps-3">
                        {dimensions
                          .filter((item) => (item.column_key ?? "").trim())
                          .map((item, idx) => (
                            <li key={`dimension-tech-${idx}`}>
                              {item.label ?? "Dimension"}: <code>{item.column_key}</code>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}

                  {metrics.some((item) => item.metric_ref != null) ? (
                    <div className="mt-2">
                      <div className="text-muted">Metric refs</div>
                      <ul className="mb-0 ps-3">
                        {metrics
                          .filter((item) => item.metric_ref != null)
                          .map((item, idx) => (
                            <li key={`metric-tech-${idx}`}>
                              {item.label ?? "Metric"}:{" "}
                              <code>{formatScalarValue(item.metric_ref)}</code>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}

                  {formattedFilters.some((item) => (item.column_key ?? "").trim()) ? (
                    <div className="mt-2">
                      <div className="text-muted">Filter columns</div>
                      <ul className="mb-0 ps-3">
                        {formattedFilters
                          .filter((item) => (item.column_key ?? "").trim())
                          .map((item, idx) => (
                            <li key={`filter-tech-${idx}`}>
                              {item.label ?? "Filter"}: <code>{item.column_key}</code>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}

      {onApplyChanges ? (
        <div className="d-flex justify-content-end mt-3">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onApplyChanges}
            disabled={!canApply}
          >
            Apply changes
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default PlanExplanation;
