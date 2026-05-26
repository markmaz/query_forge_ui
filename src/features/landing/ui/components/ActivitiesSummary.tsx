import React, { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type ActivitySummaryProps = {
  items: ActivitySummaryItem[];
  loading?: boolean;
  error?: string | null;
  latestLabel?: string | null;
  latestUpdatedAtIso?: string | null;
};

export type ActivitySummaryItem = {
  id: string;
  label: string;
  value: number;
  description: string;
  tone: "query" | "workflow" | "skill" | "forgeMatch";
  onClick?: () => void;
};

const colors: Record<ActivitySummaryItem["tone"], string> = {
  query: "#2563eb",
  workflow: "#e85d3f",
  skill: "#0f9f8f",
  forgeMatch: "#374151",
};

const formatUpdated = (iso?: string | null) => {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Date(time).toLocaleString();
};

const percent = (value: number, total: number) => {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
};

const ActivitySummary: React.FC<ActivitySummaryProps> = ({
  items,
  loading = false,
  error = null,
  latestLabel,
  latestUpdatedAtIso,
}) => {
  const totalCount = useMemo(() => items.reduce((total, item) => total + item.value, 0), [items]);
  const chartData = useMemo(() => items.filter((item) => item.value > 0), [items]);
  const canRenderChart = typeof window !== "undefined" && "ResizeObserver" in window && chartData.length > 0;

  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body d-flex align-items-start justify-content-between gap-2">
        <div>
          <div className="fw-semibold">Your activity</div>
          <div className="small text-muted">Last 14 days across work surfaces</div>
        </div>
        <span className="badge text-bg-light">{totalCount}</span>
      </div>

      <div className="card-body">
        <div className="border rounded-2 p-2 position-relative mb-3" style={{ minHeight: 190 }}>
          {loading ? (
            <div className="d-flex h-100 align-items-center justify-content-center text-muted">Loading activity...</div>
          ) : canRenderChart ? (
            <ResponsiveContainer width="100%" height={176}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={3}
                  stroke="#fff"
                  strokeWidth={3}
                >
                  {chartData.map((item) => (
                    <Cell key={item.id} fill={colors[item.tone]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} item${value === 1 ? "" : "s"} (${percent(value, totalCount)})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="d-flex h-100 align-items-center justify-content-center text-center text-muted px-3">
              Activity will appear here after queries, workflow runs, skills, or Forge Match sessions are created.
            </div>
          )}
          {canRenderChart ? (
            <div className="position-absolute top-50 start-50 translate-middle text-center pe-none">
              <div className="fs-3 fw-semibold lh-1">{totalCount}</div>
              <div className="text-muted small">items</div>
            </div>
          ) : null}
        </div>

        <div className="d-grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              className="btn btn-light border text-start p-2"
              type="button"
              onClick={item.onClick}
              disabled={!item.onClick}
            >
              <div className="d-flex align-items-start justify-content-between gap-2">
                <div className="d-flex align-items-start gap-2">
                  <span
                    className="rounded-circle mt-1"
                    style={{
                      width: 10,
                      height: 10,
                      background: colors[item.tone],
                      display: "inline-block",
                      flex: "0 0 auto",
                    }}
                  />
                  <span>
                    <span className="fw-semibold d-block">{item.label}</span>
                    <span className="small text-muted">{item.description}</span>
                  </span>
                </div>
                <span className="text-end">
                  <span className="fw-semibold d-block">{item.value}</span>
                  <span className="small text-muted">{percent(item.value, totalCount)}</span>
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="text-muted small mt-3">
          {error ? (
            error
          ) : latestLabel ? (
            <>
              Most recent: {latestLabel}
              {formatUpdated(latestUpdatedAtIso) ? ` · ${formatUpdated(latestUpdatedAtIso)}` : ""}
            </>
          ) : (
            "No recent activity yet."
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivitySummary;
