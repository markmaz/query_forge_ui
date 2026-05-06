import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { routes } from "@/app/navigation/routes";
import { useCan } from "@/shared/runtime/useCan";
import {
  getFlowForgeRun,
  listFlowForgeRunEvents,
  listFlowForgeRunHumanTasks,
  listFlowForgeRunNotifications,
} from "../api/runsApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import HumanTaskPanel from "../components/HumanTaskPanel";
import MatchingExplanationPanel from "../components/MatchingExplanationPanel";
import NotificationStatusPanel from "../components/NotificationStatusPanel";
import OperatorNoteForm from "../components/OperatorNoteForm";
import RunTimeline from "../components/RunTimeline";
import StatusBadge from "../components/StatusBadge";
import { formatFlowForgeDate, summarizeJson } from "../components/runtimeFormat";
import "./flowforge.css";

export default function FlowForgeRunDetailPage() {
  const params = useParams();
  const runId = Number(params.runId);
  const validRunId = Number.isFinite(runId) && runId > 0;
  const { hasRole } = useCan();
  const canAddNote = hasRole("flowforge", "operator");

  const runQuery = useQuery({
    queryKey: ["flowforge", "run", runId],
    queryFn: () => getFlowForgeRun(runId),
    enabled: validRunId,
  });
  const eventsQuery = useQuery({
    queryKey: ["flowforge", "run-events", runId],
    queryFn: () => listFlowForgeRunEvents(runId, 200),
    enabled: validRunId,
  });
  const tasksQuery = useQuery({
    queryKey: ["flowforge", "run-human-tasks", runId],
    queryFn: () => listFlowForgeRunHumanTasks(runId, 100),
    enabled: validRunId,
  });
  const notificationsQuery = useQuery({
    queryKey: ["flowforge", "run-notifications", runId],
    queryFn: () => listFlowForgeRunNotifications(runId, 100),
    enabled: validRunId,
  });

  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data?.events]);
  const tasks = tasksQuery.data?.tasks ?? [];
  const notifications = notificationsQuery.data?.notifications ?? [];
  const run = runQuery.data;

  if (!validRunId) {
    return (
      <main className="ff-page">
        <div className="ff-runtime-panel">Invalid FlowForge run id.</div>
      </main>
    );
  }

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title={`Run ${runId}`}
        description="Inspect timeline, human tasks, notifications, and matching context for this workflow run."
        actions={
          <Link className="btn btn-outline-secondary" to={routes.FlowForgeRuns}>
            Back to Runs
          </Link>
        }
      />

      <section className="ff-runtime-panel">
        {runQuery.isLoading ? <div className="ff-empty-state">Loading run...</div> : null}
        {runQuery.isError ? <div className="ff-empty-state">Unable to load run.</div> : null}
        {run ? (
          <div className="ff-run-hero">
            <div>
              <span>Status</span>
              <StatusBadge status={run.status} />
            </div>
            <div>
              <span>Mode</span>
              <strong>{run.mode}</strong>
            </div>
            <div>
              <span>Current node</span>
              <strong>{run.current_node_id || "Not set"}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{formatFlowForgeDate(run.updated_at || run.created_at)}</strong>
            </div>
            <div className="ff-run-context">
              <span>Context</span>
              <strong>{summarizeJson(run.run_context)}</strong>
            </div>
          </div>
        ) : null}
      </section>

      <div className="ff-runtime-grid">
        <section className="ff-runtime-panel">
          <h2>Timeline</h2>
          <RunTimeline events={events} />
        </section>
        <section className="ff-runtime-panel">
          <h2>Human Tasks</h2>
          <HumanTaskPanel tasks={tasks} />
        </section>
      </div>

      <div className="ff-runtime-grid">
        <section className="ff-runtime-panel">
          <h2>Notifications</h2>
          <NotificationStatusPanel notifications={notifications} />
        </section>
        <section className="ff-runtime-panel">
          <h2>Operator Note</h2>
          <OperatorNoteForm runId={runId} canAddNote={canAddNote} />
        </section>
      </div>

      <MatchingExplanationPanel run={run} events={events} tasks={tasks} />
    </main>
  );
}
