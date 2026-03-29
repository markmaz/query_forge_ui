import { useMemo, useState } from "react";
import { usePipelineProfile, usePipelineProfiles } from "@/features/system-admin/hooks";
import type { PipelineProfile } from "@/features/system-admin/types";
import AggregateStats from "./AggregateStats";
import ProfileDetail from "./ProfileDetail";
import { formatPipelineTimestamp } from "./formatPipelineTimestamp";
import AdminChartCard from "@/features/admin/charts/AdminChartCard";
import { formatSeconds } from "@/features/admin/charts/AdminChartTheme";
import "../systemAdmin.css";
import "@/styles/admin-charts.css";

function timingClass(ms: number): string {
  if (ms < 500) return "fast";
  if (ms <= 2000) return "medium";
  return "slow";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function matchesQuery(profile: PipelineProfile, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    profile.trace_id,
    profile.user_id,
    profile.workspace_id,
    profile.conversation_id,
    profile.prompt,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export default function ProfileList() {
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = usePipelineProfiles(limit);
  const detailQuery = usePipelineProfile(selectedTraceId);

  const filtered = useMemo(() => {
    if (!data?.profiles) return [];
    return data.profiles.filter((profile) => matchesQuery(profile, search));
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="admin-charts-page">
        <AdminChartCard title="Pipeline Profiles" subtitle="Loading profiler records.">
          <div className="admin-chart-skeleton" />
        </AdminChartCard>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-charts-page">
        <AdminChartCard title="Pipeline Profiles" subtitle="We could not load profiler records.">
          <div className="admin-error-card">
            <div>Failed to load profiles: {(error as Error).message}</div>
            <div>
              <button className="btn btn-sm btn-outline-light" onClick={() => void refetch()}>
                Retry
              </button>
            </div>
          </div>
        </AdminChartCard>
      </div>
    );
  }

  const selectedSummary =
    filtered.find((profile) => profile.trace_id === selectedTraceId) ??
    data?.profiles.find((profile) => profile.trace_id === selectedTraceId) ??
    null;
  const selectedProfile = detailQuery.data ?? selectedSummary;

  return (
    <div className="admin-charts-page">
      <div className="sa-page-header">
        <div>
          <h1>Pipeline Profiles</h1>
          <p className="sa-page-subtitle">
            Inspect planner trace timing, shared pipeline node execution, and policy-driven reranking details from recent runs.
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => void refetch()}>
          Refresh
        </button>
      </div>

      <AggregateStats profiles={filtered} />

      <div className="sa-toolbar mb-3">
        <label style={{ fontSize: "0.86rem", fontWeight: 600 }}>
          Limit
          <select
            className="form-select form-select-sm ms-2"
            style={{ width: "auto", display: "inline-block" }}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Search by trace, prompt, user, workspace…"
          style={{ maxWidth: 360 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <AdminChartCard title="No Pipeline Profiles" subtitle="Try adjusting filters or increase limit.">
          <div className="admin-empty-card">
            <div>No profiles found for the current filter criteria.</div>
            <div className="text-muted">Profiler records appear here after pipeline runs complete.</div>
          </div>
        </AdminChartCard>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Trace ID</th>
                <th>Prompt</th>
                <th>Total</th>
                <th>User ID</th>
                <th>Conversation ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <tr
                  key={profile.trace_id}
                  className="expandable"
                  onClick={() => setSelectedTraceId(profile.trace_id)}
                >
                  <td>{formatPipelineTimestamp(profile.timestamp)}</td>
                  <td>
                    <code>{profile.trace_id.slice(0, 8)}</code>
                    <button
                      className="sa-copy-btn ms-1"
                      title="Copy trace ID"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(profile.trace_id);
                      }}
                    >
                      <i className="fa fa-copy" />
                    </button>
                  </td>
                  <td>
                    <span className="sa-truncate-lg" style={{ display: "inline-block" }} title={profile.prompt}>
                      {profile.prompt.length > 72 ? profile.prompt.slice(0, 72) + "…" : profile.prompt}
                    </span>
                  </td>
                  <td>
                    <span className={`sa-timing ${timingClass(profile.total_ms)}`} title={`${profile.total_ms} ms`}>
                      {formatSeconds(profile.total_ms)}
                    </span>
                  </td>
                  <td className="sa-truncate">{profile.user_id}</td>
                  <td className="sa-truncate">{profile.conversation_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTraceId ? (
        <>
          <div className="sa-drawer-backdrop" onClick={() => setSelectedTraceId(null)} />
          <aside className="sa-drawer sa-pipeline-profile-drawer" role="dialog" aria-label={`Pipeline profile ${selectedTraceId}`}>
            <div className="sa-drawer-header">
              <div>
                <h2>Pipeline Trace</h2>
                <div className="text-muted" style={{ fontSize: "0.84rem", marginTop: 4 }}>
                  {selectedProfile ? selectedProfile.trace_id : selectedTraceId}
                </div>
              </div>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedTraceId(null)}>
                Close
              </button>
            </div>
            <div className="sa-drawer-body">
              {detailQuery.isLoading && !detailQuery.data ? (
                <div className="sa-drawer-form-card">
                  <div className="admin-chart-skeleton" />
                </div>
              ) : null}

              {detailQuery.isError ? (
                <div className="sa-drawer-form-card">
                  <div className="admin-error-card">
                    <div>Failed to load trace detail: {(detailQuery.error as Error).message}</div>
                    <div>
                      <button
                        className="btn btn-sm btn-outline-light"
                        onClick={() => {
                          void detailQuery.refetch();
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedProfile ? <ProfileDetail profile={selectedProfile} /> : null}
            </div>
            <div className="sa-drawer-footer">
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  if (selectedProfile) copyToClipboard(selectedProfile.trace_id);
                }}
              >
                Copy Trace ID
              </button>
              <button className="btn btn-dark" onClick={() => setSelectedTraceId(null)}>
                Done
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
