import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ActivityPulseDay = {
  date: string;
  label: string;
  queries: number;
  workflows: number;
  skills: number;
  forgeMatch: number;
};

export type ActivityPulseMetric = {
  label: string;
  value: number;
  tone: "query" | "workflow" | "skill" | "forgeMatch";
};

export type ActivityPulseWidgetProps = {
  days: ActivityPulseDay[];
  metrics: ActivityPulseMetric[];
  totalCount: number;
  onOpenActivity?: () => void;
};

const colors = {
  queries: "#2563eb",
  workflows: "#e85d3f",
  skills: "#0f9f8f",
  forgeMatch: "#374151",
};

const metricColors: Record<ActivityPulseMetric["tone"], string> = {
  query: colors.queries,
  workflow: colors.workflows,
  skill: colors.skills,
  forgeMatch: colors.forgeMatch,
};

const hasChartData = (days: ActivityPulseDay[]) =>
  days.some((day) => day.queries + day.workflows + day.skills + day.forgeMatch > 0);

const ActivityPulseWidget: React.FC<ActivityPulseWidgetProps> = ({
  days,
  metrics,
  totalCount,
  onOpenActivity,
}) => {
  const canRenderChart = typeof window !== "undefined" && "ResizeObserver" in window && hasChartData(days);

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-body d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <div className="fw-semibold">Workspace pulse</div>
          <div className="small text-muted">Rolling activity across QueryForge work surfaces</div>
        </div>
        <button className="btn btn-link btn-sm text-decoration-none" type="button" onClick={onOpenActivity}>
          View activity
        </button>
      </div>

      <div className="card-body">
        <div className="row g-3 align-items-stretch">
          <div className="col-12 col-xl-8">
            <div
              role="button"
              tabIndex={0}
              className="border rounded-2 p-3 h-100 position-relative"
              style={{ minHeight: 260, cursor: onOpenActivity ? "pointer" : "default" }}
              onClick={onOpenActivity}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && onOpenActivity) {
                  event.preventDefault();
                  onOpenActivity();
                }
              }}
            >
              {canRenderChart ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={days} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} width={28} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="queries" name="Queries" stackId="activity" fill={colors.queries} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="workflows" name="Workflows" stackId="activity" fill={colors.workflows} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="skills" name="Skills" stackId="activity" fill={colors.skills} radius={[0, 0, 0, 0]} />
                    <Bar
                      dataKey="forgeMatch"
                      name="Forge Match"
                      stackId="activity"
                      fill={colors.forgeMatch}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="d-flex h-100 align-items-center justify-content-center text-muted">
                  Activity will appear here as work is created or updated.
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="h-100 d-flex flex-column gap-2">
              <div className="border rounded-2 p-3">
                <div className="text-muted small">14 day activity</div>
                <div className="display-6 fw-semibold mb-0">{totalCount}</div>
              </div>

              <div className="row g-2">
                {metrics.map((metric) => (
                  <div key={metric.label} className="col-6">
                    <div className="border rounded-2 p-3 h-100">
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="rounded-circle"
                          style={{
                            width: 10,
                            height: 10,
                            background: metricColors[metric.tone],
                            display: "inline-block",
                          }}
                        />
                        <span className="text-muted small">{metric.label}</span>
                      </div>
                      <div className="fs-4 fw-semibold mt-1">{metric.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary mt-auto" type="button" onClick={onOpenActivity}>
                Open activity center
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityPulseWidget;
