import { type CSSProperties, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getFlowForgeIntakeRawForm, getFlowForgeIntakeReviewTimeline, getFlowForgeReportDashboard } from "../api/reportsApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import { buildQueryForgeDomainLaunchUrl } from "../model/queryForgeLaunch";
import type {
  FlowForgeIntakeRawForm,
  FlowForgeIntakeReviewBucket,
  FlowForgeIntakeReviewEvent,
  FlowForgeReportingDomain,
} from "../model/reportTypes";
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

const heroMetrics = ["run_count", "assignment_count", "no_match_outcome_count", "failed_notification_count"];

function registrationBadgeClass(domain: FlowForgeReportingDomain) {
  const status = domain.registration_status ?? (domain.semantic_registered ? "registered" : "pending");
  return ["registered", "validated"].includes(status) && !domain.registration_issues?.length ? "is-success" : "is-warning";
}

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function FlowForgeReportsPage() {
  const [mode, setMode] = useState("production");
  const [selectedDomain, setSelectedDomain] = useState<FlowForgeReportingDomain | null>(null);
  const [selectedReviewEvent, setSelectedReviewEvent] = useState<FlowForgeIntakeReviewEvent | null>(null);
  const dashboardQuery = useQuery({
    queryKey: ["flowforge", "reports", "dashboard", mode],
    queryFn: () => getFlowForgeReportDashboard(mode),
  });
  const intakeReviewQuery = useQuery({
    queryKey: ["flowforge", "reports", "intake-review", mode],
    queryFn: () => getFlowForgeIntakeReviewTimeline(mode, 7),
  });
  const rawIntakeQuery = useQuery({
    queryKey: ["flowforge", "reports", "intake-review", selectedReviewEvent?.intake_event_id, "raw"],
    queryFn: () => getFlowForgeIntakeRawForm(selectedReviewEvent!.intake_event_id),
    enabled: selectedReviewEvent !== null,
    retry: false,
  });
  const dashboard = dashboardQuery.data;
  const intakeReview = intakeReviewQuery.data;
  const starterQuestions = useMemo(
    () =>
      (dashboard?.domains ?? []).flatMap((domain) =>
        domain.query_studio_prompts.map((prompt) => ({
          domain,
          prompt,
        })),
      ),
    [dashboard?.domains],
  );

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Workflow Intelligence"
        description={
          <>
            Production-default business intelligence over governed Workflow Studio outcomes. Raw intake payloads,
            signed-token data, notification recipients, and sensitive profiles are excluded from the default reporting
            contract.
          </>
        }
        actions={
          <select className="form-select" aria-label="Reporting mode" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="production">Production only</option>
            <option value="test">Test mode</option>
          </select>
        }
      />

      <section className="ff-runtime-panel" aria-label="Workflow Intelligence metrics">
        <div className="ff-report-hero">
          {heroMetrics.map((key) => (
            <article key={key} className="ff-report-metric-card">
              <span>{metricLabels[key] ?? key}</span>
              <strong>{dashboard?.metrics?.[key] ?? 0}</strong>
            </article>
          ))}
        </div>
        {dashboardQuery.isError ? (
          <div className="ff-empty-state">Reports are unavailable. Check Workflow Studio API logs and workspace access.</div>
        ) : null}
      </section>

      <section className="ff-runtime-panel" aria-label="Rolling intake review">
        <div className="ff-section-heading">
          <div>
            <span>Rolling week</span>
            <h2>Intake acceptance review</h2>
          </div>
        </div>
        <IntakeReviewChart
          buckets={intakeReview?.buckets ?? []}
          isLoading={intakeReviewQuery.isLoading}
          isError={intakeReviewQuery.isError}
          onReviewRawIntake={setSelectedReviewEvent}
        />
      </section>

      <section className="ff-runtime-panel">
        <div className="ff-section-heading">
          <div>
            <span>Workflow Intelligence domains</span>
            <h2>Governed QueryForge domains</h2>
          </div>
        </div>
        <div className="ff-report-domain-layout">
          <div className="ff-report-domain-grid">
            {(dashboard?.domains ?? []).map((domain) => (
              <article key={domain.domain_key} className="ff-runtime-card ff-report-domain-card">
                <div className="ff-card-heading">
                  <div>
                    <span>{domain.domain_key}</span>
                    <strong>{domain.display_name}</strong>
                  </div>
                  <span className={`ff-status-badge ${registrationBadgeClass(domain)}`}>
                    {domain.registration_status ?? (domain.semantic_registered ? "registered" : "pending")}
                  </span>
                </div>
                <p className="ff-muted">{domain.description}</p>
                {domain.registration_issues?.length ? (
                  <div className="ff-report-warning" role="status">
                    {domain.registration_issues[0]}
                  </div>
                ) : null}
                <dl className="ff-definition-grid">
                  <div>
                    <dt>Read model</dt>
                    <dd>{domain.read_model}</dd>
                  </div>
                  <div>
                    <dt>Metrics</dt>
                    <dd>{domain.metrics.map((metric) => metric.label).join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{domain.dimensions.map((dimension) => dimension.label).join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Sensitive exclusions</dt>
                    <dd>{domain.sensitive_excluded_fields.join(", ")}</dd>
                  </div>
                </dl>
                <div className="ff-report-domain-actions">
                  <Link to={buildQueryForgeDomainLaunchUrl(domain, domain.query_studio_prompts[0])} className="btn btn-primary btn-sm">
                    Ask in QueryForge
                  </Link>
                  <Link to={buildQueryForgeDomainLaunchUrl(domain)} className="btn btn-outline-secondary btn-sm">
                    Open Domain
                  </Link>
                  <button type="button" className="btn btn-link btn-sm" onClick={() => setSelectedDomain(domain)}>
                    Details
                  </button>
                </div>
              </article>
            ))}
          </div>
          <aside className="ff-report-question-panel" aria-label="Potential QueryForge questions">
            <div className="ff-report-question-panel-heading">
              <span>Potential Query Questions</span>
              <strong>Launch governed prompts</strong>
            </div>
            <div className="ff-report-question-list">
              {starterQuestions.map(({ domain, prompt }) => (
                <Link
                  key={`${domain.domain_key}:${prompt}`}
                  to={buildQueryForgeDomainLaunchUrl(domain, prompt)}
                  className="ff-report-question-link"
                >
                  <span>{domain.display_name}</span>
                  <strong>{prompt}</strong>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>
      {selectedDomain ? <DomainDetailDrawer domain={selectedDomain} onClose={() => setSelectedDomain(null)} /> : null}
      {selectedReviewEvent ? (
        <RawIntakeDrawer
          event={selectedReviewEvent}
          rawForm={rawIntakeQuery.data}
          isLoading={rawIntakeQuery.isLoading}
          isError={rawIntakeQuery.isError}
          onClose={() => setSelectedReviewEvent(null)}
        />
      ) : null}
    </main>
  );
}

function IntakeReviewChart({
  buckets,
  isLoading,
  isError,
  onReviewRawIntake,
}: {
  buckets: FlowForgeIntakeReviewBucket[];
  isLoading: boolean;
  isError: boolean;
  onReviewRawIntake: (event: FlowForgeIntakeReviewEvent) => void;
}) {
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.intake_count));
  if (isLoading) {
    return <div className="ff-empty-state">Loading intake review data.</div>;
  }
  if (isError) {
    return <div className="ff-empty-state">Intake review data is unavailable.</div>;
  }
  if (!buckets.length) {
    return <div className="ff-empty-state">No intake events found for the rolling week.</div>;
  }
  return (
    <div className="ff-intake-review-chart">
      {buckets.map((bucket) => (
        <div key={bucket.date} className="ff-intake-day">
          <div className="ff-intake-bar-shell" aria-label={`${formatDay(bucket.date)} intake count ${bucket.intake_count}`}>
            <div
              className="ff-intake-bar"
              style={{ "--ff-intake-ratio": `${Math.max(0.08, bucket.intake_count / maxCount)}` } as CSSProperties}
            />
            <div className="ff-intake-event-points">
              {bucket.events.map((event) =>
                event.outcome === "not_accepted" ? (
                  <button
                    key={event.intake_event_id}
                    type="button"
                    className="ff-intake-event-point is-not-accepted"
                    aria-label={`Review raw intake ${event.intake_event_id}: ${event.outcome_label}`}
                    onClick={() => onReviewRawIntake(event)}
                  />
                ) : (
                  <span
                    key={event.intake_event_id}
                    className={`ff-intake-event-point ${event.outcome === "accepted" ? "is-accepted" : "is-pending"}`}
                    title={event.outcome_label}
                  />
                ),
              )}
            </div>
          </div>
          <div className="ff-intake-day-label">
            <span>{formatDay(bucket.date)}</span>
            <strong>{bucket.intake_count}</strong>
          </div>
          <div className="ff-intake-day-outcomes">
            <span>{bucket.accepted_count} accepted</span>
            <span>{bucket.not_accepted_count} not accepted</span>
          </div>
          {bucket.events.some((event) => event.outcome === "accepted") ? (
            <ul className="ff-intake-accepted-list">
              {bucket.events
                .filter((event) => event.outcome === "accepted")
                .map((event) => (
                  <li key={event.intake_event_id}>{event.accepted_by ?? "Accepted"}</li>
                ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RawIntakeDrawer({
  event,
  rawForm,
  isLoading,
  isError,
  onClose,
}: {
  event: FlowForgeIntakeReviewEvent;
  rawForm?: FlowForgeIntakeRawForm;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  return (
    <div className="ff-report-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="ff-report-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Raw intake ${event.intake_event_id} review`}
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <div className="ff-report-drawer-header">
          <div>
            <span>{event.outcome_label}</span>
            <h2>Raw Intake Review</h2>
          </div>
          <button type="button" className="ff-node-config-drawer-close" aria-label="Close raw intake review" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ff-report-drawer-body">
          <dl className="ff-definition-grid">
            <div>
              <dt>Intake</dt>
              <dd>{event.intake_event_id}</dd>
            </div>
            <div>
              <dt>Submission</dt>
              <dd>{event.external_submission_id ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{rawForm?.provider ?? event.provider ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{formatDateTime(rawForm?.received_at ?? event.received_at)}</dd>
            </div>
          </dl>
          {isLoading ? <div className="ff-empty-state">Loading retained intake form.</div> : null}
          {isError ? <div className="ff-report-warning">Raw intake review requires Workflow operator access.</div> : null}
          {rawForm && !rawForm.raw_payload_available ? (
            <div className="ff-report-warning">Raw intake payload is no longer retained for this submission.</div>
          ) : null}
          {rawForm ? <JsonPanel title="Raw form" value={rawForm.raw_payload} /> : null}
          {rawForm ? <JsonPanel title="Normalized form" value={rawForm.normalized_payload} /> : null}
        </div>
      </aside>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <section className="ff-report-json-panel">
      <h3>{title}</h3>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

function DomainDetailDrawer({ domain, onClose }: { domain: FlowForgeReportingDomain; onClose: () => void }) {
  return (
    <div className="ff-report-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="ff-report-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${domain.display_name} details`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ff-report-drawer-header">
          <div>
            <span>{domain.domain_group ?? "workflow_intelligence"}</span>
            <h2>{domain.display_name}</h2>
          </div>
          <button type="button" className="ff-node-config-drawer-close" aria-label="Close domain details" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ff-report-drawer-body">
          <dl className="ff-definition-grid">
            <div>
              <dt>Read model</dt>
              <dd>{domain.read_model}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{domain.domain_source ?? "flowforge_system"}</dd>
            </div>
            <div>
              <dt>Default filter</dt>
              <dd>{domain.default_filters.map((filter) => `${filter.field} ${filter.operator} ${String(filter.value)}`).join(", ")}</dd>
            </div>
            <div>
              <dt>Time fields</dt>
              <dd>{domain.time_fields?.join(", ") || "None"}</dd>
            </div>
          </dl>
          <SectionList title="Metrics" items={domain.metrics.map((metric) => metric.label)} />
          <SectionList title="Dimensions" items={domain.dimensions.map((dimension) => dimension.label)} />
          <SectionList title="Sensitive exclusions" items={domain.sensitive_excluded_fields} />
          <SectionList title="Starter prompts" items={domain.query_studio_prompts} />
        </div>
      </aside>
    </div>
  );
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="ff-report-detail-section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
