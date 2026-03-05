import { useState, useMemo } from "react";
import { usePipelineProfiles } from "@/features/system-admin/hooks";
import type { PipelineProfile } from "@/features/system-admin/types";
import AggregateStats from "./AggregateStats";
import ProfileDetail from "./ProfileDetail";
import "../systemAdmin.css";

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

  const { data, isLoading, isError, error } = usePipelineProfiles(limit);

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
      <div className="sa-loading">
        <span className="sa-spinner lg" />
        Loading pipeline profiles…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sa-chart-section" style={{ color: "#991b1b" }}>
        <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
        Failed to load profiles: {(error as Error).message}
      </div>
    );
  }

  const toggleRow = (traceId: string) =>
    setExpandedId((prev) => (prev === traceId ? null : traceId));

  return (
    <div>
      <AggregateStats profiles={filtered} />

      <div className="sa-toolbar">
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

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Trace ID</th>
              <th>Prompt</th>
              <th>Total ms</th>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>
                  No profiles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
        <td>{new Date(profile.timestamp).toLocaleString()}</td>
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
          <span className={`sa-timing ${timingClass(profile.total_ms)}`}>
            {profile.total_ms} ms
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
