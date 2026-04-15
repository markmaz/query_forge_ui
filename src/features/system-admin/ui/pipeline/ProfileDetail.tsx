import type {
  PipelineProfile,
  PipelineTracePayload,
  PipelineTraceStepRecord,
  SharedPipelineSnapshot,
  SharedPipelineTraceNode,
} from "@/features/system-admin/types";
import StepChart from "./StepChart";
import AdminChartCard from "@/features/admin/charts/AdminChartCard";
import { formatPipelineTimestamp } from "./formatPipelineTimestamp";

interface ProfileDetailProps {
  profile: PipelineProfile;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSharedPipelines(pipelineTrace: PipelineTracePayload | undefined): Array<[string, SharedPipelineSnapshot]> {
  const shared = pipelineTrace?.response?.debug?.shared_pipeline;
  if (!shared || typeof shared !== "object") return [];
  return Object.entries(shared).filter((entry): entry is [string, SharedPipelineSnapshot] => {
    const [, snapshot] = entry;
    return !!snapshot && typeof snapshot === "object" && typeof snapshot.pipeline_name === "string";
  });
}

function getTraceSteps(pipelineTrace: PipelineTracePayload | undefined): PipelineTraceStepRecord[] {
  return Array.isArray(pipelineTrace?.steps) ? pipelineTrace.steps : [];
}

function getProjectionPolicyDebug(
  pipelineTrace: PipelineTracePayload | undefined,
): Record<string, unknown> | null {
  const debug = pipelineTrace?.response?.debug;
  if (!debug || typeof debug !== "object") return null;
  const projection = debug["projection_policy"];
  return projection && typeof projection === "object" ? (projection as Record<string, unknown>) : null;
}

export default function ProfileDetail({ profile }: ProfileDetailProps) {
  const sharedPipelines = getSharedPipelines(profile.pipeline_trace);
  const traceSteps = getTraceSteps(profile.pipeline_trace);
  const projectionPolicyDebug = getProjectionPolicyDebug(profile.pipeline_trace);

  return (
    <div className="sa-detail-content sa-pipeline-detail">
      <div className="sa-detail-meta">
        <div className="sa-detail-meta-item">
          <span className="label">Trace ID</span> <span className="value">{profile.trace_id}</span>
        </div>
        <div className="sa-detail-meta-item">
          <span className="label">Workspace</span> <span className="value">{profile.workspace_id}</span>
        </div>
        <div className="sa-detail-meta-item">
          <span className="label">User</span> <span className="value">{profile.user_id}</span>
        </div>
        <div className="sa-detail-meta-item">
          <span className="label">Conversation</span> <span className="value">{profile.conversation_id}</span>
        </div>
        <div className="sa-detail-meta-item">
          <span className="label">Timestamp</span> <span className="value">{formatPipelineTimestamp(profile.timestamp)}</span>
        </div>
      </div>

      <AdminChartCard
        title={
          <span>
            <i className="fa fa-comment" style={{ marginRight: 6 }} />
            Prompt
          </span>
        }
      >
        <p style={{ margin: 0, fontSize: "0.88rem", whiteSpace: "pre-wrap" }}>{profile.prompt}</p>
      </AdminChartCard>

      {profile.steps.length > 0 ? <StepChart steps={profile.steps} totalMs={profile.total_ms} /> : null}

      {sharedPipelines.length > 0 ? (
        <AdminChartCard
          title="Shared Pipeline Nodes"
          subtitle="Shared DAG stages, signals, and policy effects captured during the request."
        >
          <div className="sa-pipeline-shared-grid">
            {sharedPipelines.map(([key, snapshot]) => (
              <SharedPipelineCard key={key} name={key} snapshot={snapshot} />
            ))}
          </div>
        </AdminChartCard>
      ) : null}

      {projectionPolicyDebug ? (
        <AdminChartCard
          title="Projection Policies"
          subtitle="Deterministic projection/filter policy matches applied after planner-domain selection."
        >
          <ProjectionPolicyCard debug={projectionPolicyDebug} />
        </AdminChartCard>
      ) : null}

      {traceSteps.length > 0 ? (
        <AdminChartCard title="Trace Steps" subtitle="Planner trace checkpoints with captured payload summaries.">
          <div className="sa-pipeline-trace-list">
            {traceSteps.map((step, index) => (
              <TraceStepCard key={`${step.step}-${index}`} step={step} />
            ))}
          </div>
        </AdminChartCard>
      ) : null}

      {profile.pipeline_trace ? (
        <AdminChartCard title="Trace Metadata" subtitle="Raw trace metadata retained for support and diagnostics.">
          <div className="sa-detail-meta">
            <div className="sa-detail-meta-item">
              <span className="label">Trace Logging</span>
              <span className="value">{profile.pipeline_trace.trace_enabled ? "Enabled" : "Disabled"}</span>
            </div>
            {profile.pipeline_trace.log_file ? (
              <div className="sa-detail-meta-item">
                <span className="label">Log File</span>
                <span className="value">{profile.pipeline_trace.log_file}</span>
              </div>
            ) : null}
          </div>
        </AdminChartCard>
      ) : null}
    </div>
  );
}

function SharedPipelineCard({ name, snapshot }: { name: string; snapshot: SharedPipelineSnapshot }) {
  const nodeRows = Array.isArray(snapshot.trace_nodes) ? snapshot.trace_nodes : [];
  const signalList = extractSignals(snapshot);
  const capabilityCounts = extractCapabilityCounts(snapshot);

  return (
    <div className="sa-pipeline-shared-card">
      <div className="sa-pipeline-shared-card__header">
        <div>
          <div className="sa-pipeline-shared-card__title">{titleCase(name)}</div>
          <div className="sa-pipeline-shared-card__meta">{snapshot.pipeline_name}</div>
        </div>
        {snapshot.vertical_norm ? <span className="sa-badge">{snapshot.vertical_norm}</span> : null}
      </div>

      {signalList.length > 0 ? (
        <div className="sa-pipeline-chip-group">
          {signalList.map((signal) => (
            <span key={signal} className="sa-pipeline-chip">
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      {Object.keys(capabilityCounts).length > 0 ? (
        <div className="sa-pipeline-capability-list">
          {Object.entries(capabilityCounts).map(([candidateId, count]) => (
            <div key={candidateId} className="sa-pipeline-capability-item">
              <span>Candidate {candidateId}</span>
              <strong>{count} capabilities</strong>
            </div>
          ))}
        </div>
      ) : null}

      {nodeRows.length > 0 ? (
        <table className="sa-step-table sa-pipeline-node-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Lineage</th>
            </tr>
          </thead>
          <tbody>
            {nodeRows.map((node, index) => (
              <SharedPipelineNodeRow key={`${node.node}-${index}`} node={node} />
            ))}
          </tbody>
        </table>
      ) : (
        <pre className="sa-pipeline-json">{prettyJson(snapshot)}</pre>
      )}
    </div>
  );
}

function SharedPipelineNodeRow({ node }: { node: SharedPipelineTraceNode }) {
  return (
    <tr>
      <td>
        <div>{titleCase(node.node)}</div>
        {node.summary ? <small className="text-muted">{Object.keys(node.summary).slice(0, 3).join(", ")}</small> : null}
      </td>
      <td>{titleCase(node.status)}</td>
      <td>{typeof node.ms === "number" ? `${node.ms} ms` : "—"}</td>
      <td>{Array.isArray(node.lineage) && node.lineage.length > 0 ? node.lineage.join(" → ") : "—"}</td>
    </tr>
  );
}

function TraceStepCard({ step }: { step: PipelineTraceStepRecord }) {
  return (
    <div className="sa-pipeline-trace-card">
      <div className="sa-pipeline-trace-card__title">{titleCase(step.step)}</div>
      <pre className="sa-pipeline-json">{prettyJson(step.data ?? {})}</pre>
    </div>
  );
}

function ProjectionPolicyCard({ debug }: { debug: Record<string, unknown> }) {
  const matchedPolicies = Array.isArray(debug.matched_policies)
    ? debug.matched_policies.map((item) => String(item)).filter(Boolean)
    : [];
  const promptSignals = Array.isArray(debug.prompt_signals)
    ? debug.prompt_signals.map((item) => String(item)).filter(Boolean)
    : [];
  const actionRows: Array<[string, string[]]> = [
    ["Required Concepts", asStringList(debug.required_concept_keys)],
    ["Excluded Concepts", asStringList(debug.excluded_concept_keys)],
    ["Required Columns", asStringList(debug.required_column_names)],
    ["Excluded Columns", asStringList(debug.excluded_column_names)],
    ["Required Filter Concepts", asStringList(debug.required_filter_concept_keys)],
    ["Required Join Tables", asStringList(debug.required_join_tables)],
  ].filter(([, values]) => values.length > 0);

  return (
    <div className="sa-pipeline-shared-card">
      <div className="sa-pipeline-shared-card__header">
        <div>
          <div className="sa-pipeline-shared-card__title">Projection Policy Matches</div>
          <div className="sa-pipeline-shared-card__meta">
            {matchedPolicies.length > 0 ? matchedPolicies.join(", ") : "No matched policies"}
          </div>
        </div>
        <span className="sa-badge">{titleCase(String(debug.projection_mode ?? "prepend"))}</span>
      </div>

      {promptSignals.length > 0 ? (
        <div className="sa-pipeline-chip-group">
          {promptSignals.map((signal) => (
            <span key={signal} className="sa-pipeline-chip">
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      {actionRows.length > 0 ? (
        <div className="sa-pipeline-capability-list">
          {actionRows.map(([label, values]) => (
            <div key={label} className="sa-pipeline-capability-item">
              <span>{label}</span>
              <strong>{values.join(", ")}</strong>
            </div>
          ))}
        </div>
      ) : (
        <pre className="sa-pipeline-json">{prettyJson(debug)}</pre>
      )}
    </div>
  );
}

function extractSignals(snapshot: SharedPipelineSnapshot): string[] {
  const debug = snapshot.debug ?? {};
  const extractSignalsDebug = debug["extract_signals"];
  if (
    extractSignalsDebug &&
    typeof extractSignalsDebug === "object" &&
    Array.isArray((extractSignalsDebug as { signals?: unknown[] }).signals)
  ) {
    return ((extractSignalsDebug as { signals?: unknown[] }).signals ?? [])
      .map((item) => String(item))
      .filter(Boolean);
  }
  const rerankDebug = debug["apply_policy_rerank"];
  if (rerankDebug && typeof rerankDebug === "object" && Array.isArray((rerankDebug as { signals?: unknown[] }).signals)) {
    return ((rerankDebug as { signals?: unknown[] }).signals ?? []).map((item) => String(item)).filter(Boolean);
  }
  return [];
}

function extractCapabilityCounts(snapshot: SharedPipelineSnapshot): Record<string, number> {
  const debug = snapshot.debug ?? {};
  const resolved = debug["resolve_capabilities"];
  if (!resolved || typeof resolved !== "object") return {};
  const raw = (resolved as { capability_counts?: Record<string, unknown> }).capability_counts;
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw)
      .map(([candidateId, count]) => [candidateId, Number(count)])
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
  );
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}
