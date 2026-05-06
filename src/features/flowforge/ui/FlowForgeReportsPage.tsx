import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { routes } from "@/app/navigation/routes";
import { getFlowForgeReportDashboard } from "../api/reportsApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import type { FlowForgeReportingDomain } from "../model/reportTypes";
import "./flowforge.css";

const metricLabels: Record<string, string> = {
  run_count: "Runs",
  active_run_count: "Active Runs",
  completed_run_count: "Completed Runs",
  failed_run_count: "Failed Runs",
  needs_attention_count: "Needs Attention",
  intake_event_count: "Intakes",
  matching_evaluation_count: "Matching Evaluations",
  no_match_outcome_count: "No-Match Outcomes",
  resource_snapshot_record_count: "Resource Records",
  available_resource_count: "Available Resources",
  offer_count: "Offers",
  pending_offer_count: "Pending Offers",
  completed_offer_count: "Completed Offers",
  assignment_count: "Assignments",
  notification_count: "Notifications",
  pending_notification_count: "Pending Notifications",
  failed_notification_count: "Failed Notifications",
};

const heroMetrics = ["run_count", "completed_run_count", "needs_attention_count", "assignment_count", "no_match_outcome_count", "failed_notification_count"];

function queryStudioHref(domain: FlowForgeReportingDomain, prompt: string): string {
  const params = new URLSearchParams({
    domain: domain.domain_key,
    prompt,
  });
  return `${routes.NoCodeQueryBuilder}?${params.toString()}`;
}

export default function FlowForgeReportsPage() {
  const [mode, setMode] = useState("production");
  const dashboardQuery = useQuery({
    queryKey: ["flowforge", "reports", "dashboard", mode],
    queryFn: () => getFlowForgeReportDashboard(mode),
  });
  const dashboard = dashboardQuery.data;

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Operational Outcomes"
        description={
          <>
            Production-default reporting over governed FlowForge read models. Raw intake payloads, signed-token data,
            notification recipients, and sensitive profiles are excluded from the default reporting contract.
          </>
        }
        actions={
          <select className="form-select" aria-label="Reporting mode" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="production">Production only</option>
            <option value="test">Test mode</option>
          </select>
        }
      />

      <section className="ff-runtime-panel" aria-label="FlowForge report metrics">
        <div className="ff-report-hero">
          {heroMetrics.map((key) => (
            <article key={key} className="ff-report-metric-card">
              <span>{metricLabels[key] ?? key}</span>
              <strong>{dashboard?.metrics?.[key] ?? 0}</strong>
            </article>
          ))}
        </div>
        {dashboardQuery.isError ? (
          <div className="ff-empty-state">Reports are unavailable. Check FlowForge API logs and workspace access.</div>
        ) : null}
      </section>

      <section className="ff-runtime-grid">
        <div className="ff-runtime-panel">
          <h2>Governed Query Studio Domains</h2>
          <div className="ff-card-stack">
            {(dashboard?.domains ?? []).map((domain) => (
              <article key={domain.domain_key} className="ff-runtime-card">
                <div className="ff-card-heading">
                  <div>
                    <span>{domain.domain_key}</span>
                    <strong>{domain.display_name}</strong>
                  </div>
                  <span className="ff-status-badge is-success">{domain.semantic_registered ? "registered" : "pending"}</span>
                </div>
                <p className="ff-muted">{domain.description}</p>
                <dl className="ff-definition-grid">
                  <div>
                    <dt>Read model</dt>
                    <dd>{domain.read_model}</dd>
                  </div>
                  <div>
                    <dt>Default filter</dt>
                    <dd>{domain.default_filters.map((filter) => `${filter.field} ${filter.operator} ${String(filter.value)}`).join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Metrics</dt>
                    <dd>{domain.metrics.map((metric) => metric.label).join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Sensitive exclusions</dt>
                    <dd>{domain.sensitive_excluded_fields.join(", ")}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>

        <div className="ff-runtime-panel">
          <h2>Ask In Query Studio</h2>
          <div className="ff-card-stack">
            {(dashboard?.domains ?? []).map((domain) => (
              <article key={domain.domain_key} className="ff-runtime-card">
                <div className="ff-card-heading">
                  <div>
                    <span>{domain.display_name}</span>
                    <strong>Starter prompts</strong>
                  </div>
                </div>
                <div className="ff-prompt-list">
                  {domain.query_studio_prompts.map((prompt) => (
                    <Link key={prompt} to={queryStudioHref(domain, prompt)} className="ff-prompt-link">
                      {prompt}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
