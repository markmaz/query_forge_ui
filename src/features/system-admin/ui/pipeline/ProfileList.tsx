import { useState, useMemo } from "react";
import { usePipelineProfiles } from "@/features/system-admin/hooks";
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

export default function ProfileList() {
  const [limit, setLimit] = useState(50);
  const [userFilter, setUserFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = usePipelineProfiles(limit);

  const filtered = useMemo(() => {
    if (!data?.profiles) return [];
    if (!userFilter.trim()) return data.profiles;
    const lower = userFilter.trim().toLowerCase();
    return data.profiles.filter((p) =>
      p.user_id.toLowerCase().includes(lower),
    );
  }, [data, userFilter]);

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

  const toggleRow = (traceId: string) =>
    setExpandedId((prev) => (prev === traceId ? null : traceId));

  return (
    <div className="admin-charts-page">
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
          placeholder="Filter by User ID…"
          style={{ maxWidth: 240 }}
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <AdminChartCard title="No Pipeline Profiles" subtitle="Try adjusting filters or increase limit.">
          <div className="admin-empty-card">
            <div>No profiles found for the current filter criteria.</div>
            <div className="text-muted">Profiler records appear here after pipeline runs complete.</div>
          </div>
        </AdminChartCard>
      ) : null}

      {filtered.length > 0 ? (
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
              {filtered.map((p: PipelineProfile) => (
                <ProfileRow
                  key={p.trace_id}
                  profile={p}
                  expanded={expandedId === p.trace_id}
                  onToggle={() => toggleRow(p.trace_id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

interface ProfileRowProps {
  profile: PipelineProfile;
  expanded: boolean;
  onToggle: () => void;
}

function ProfileRow({ profile, expanded, onToggle }: ProfileRowProps) {
  return (
    <>
      <tr
        className={`expandable${expanded ? " expanded" : ""}`}
        onClick={onToggle}
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
          <span
            className="sa-truncate-lg"
            style={{ display: "inline-block" }}
            title={profile.prompt}
          >
            {profile.prompt.length > 60
              ? profile.prompt.slice(0, 60) + "…"
              : profile.prompt}
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
      {expanded && (
        <tr className="sa-detail-row">
          <td colSpan={6}>
            <ProfileDetail profile={profile} />
          </td>
        </tr>
      )}
    </>
  );
}
