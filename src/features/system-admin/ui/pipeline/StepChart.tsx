import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PipelineStep } from "@/features/system-admin/types";
import AdminChartCard from "@/features/admin/charts/AdminChartCard";
import AdminChartTooltip from "@/features/admin/charts/AdminChartTooltip";
import { CHART_COLORS, GRID_COLOR, TEXT_MUTED, formatMs, formatSeconds } from "@/features/admin/charts/AdminChartTheme";

interface StepChartProps {
  steps: PipelineStep[];
  totalMs: number;
}

type UnitMode = "s" | "ms";

const STAGE_COLORS = [
  CHART_COLORS.stage1,
  CHART_COLORS.stage2,
  CHART_COLORS.stage3,
  CHART_COLORS.stage4,
  CHART_COLORS.stage5,
  CHART_COLORS.stage6,
  CHART_COLORS.stage7,
  CHART_COLORS.stage8,
];

export default function StepChart({ steps, totalMs }: StepChartProps) {
  const [unitMode, setUnitMode] = useState<UnitMode>("s");

  const stageData = useMemo(
    () =>
      steps.map((step, index) => ({
        index: step.index,
        label: step.label,
        duration_ms: step.ms,
        duration_sec: Math.round(step.ms / 10) / 100,
        fill: STAGE_COLORS[index % STAGE_COLORS.length],
        fillId: `stageBarGrad${index % STAGE_COLORS.length}`,
      })),
    [steps]
  );

  const cumulativeData = useMemo(() => {
    let cumulativeMs = 0;
    return steps.map((step, index) => {
      cumulativeMs += step.ms;
      return {
        index: step.index,
        label: step.label,
        cumulative_ms: cumulativeMs,
        cumulative_sec: Math.round(cumulativeMs / 10) / 100,
        fill: STAGE_COLORS[index % STAGE_COLORS.length],
      };
    });
  }, [steps]);

  const durationKey = unitMode === "s" ? "duration_sec" : "duration_ms";
  const cumulativeKey = unitMode === "s" ? "cumulative_sec" : "cumulative_ms";

  return (
    <div className="row g-4">
      <div className="col-12">
        <AdminChartCard
          title="Stage Timing"
          subtitle="Per-stage pipeline duration."
          actions={
            <div className="btn-group btn-group-sm" role="group" aria-label="Duration units">
              <button
                type="button"
                className={`btn ${unitMode === "s" ? "btn-light" : "btn-outline-light"}`}
                onClick={() => setUnitMode("s")}
              >
                Seconds
              </button>
              <button
                type="button"
                className={`btn ${unitMode === "ms" ? "btn-light" : "btn-outline-light"}`}
                onClick={() => setUnitMode("ms")}
              >
                Milliseconds
              </button>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={Math.max(240, stageData.length * 46)}>
            <BarChart data={stageData} layout="vertical" margin={{ top: 8, right: 24, left: 10, bottom: 4 }}>
              <defs>
                {STAGE_COLORS.map((color, index) => (
                  <linearGradient key={color} id={`stageBarGrad${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.36} />
                    <stop offset="38%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.48} />
                  </linearGradient>
                ))}
                <filter id="stageBarShadow" x="-24%" y="-24%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(15,23,42,0.22)" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fill: TEXT_MUTED }} />
              <YAxis type="category" dataKey="label" width={260} tick={{ fill: TEXT_MUTED }} />
              <Tooltip content={<AdminChartTooltip unit={unitMode} />} />
              <Bar dataKey={durationKey} radius={[0, 10, 10, 0]}>
                <LabelList
                  dataKey={durationKey}
                  position="right"
                  formatter={(value: number) =>
                    unitMode === "s" ? `${Number(value).toFixed(2)}s` : `${Math.round(Number(value))}ms`
                  }
                />
                {stageData.map((step) => (
                  <Cell key={step.index} fill={`url(#${step.fillId})`} filter="url(#stageBarShadow)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>
      </div>

      <div className="col-12">
        <AdminChartCard title="Cumulative Duration" subtitle="Where latency accumulates across stages.">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cumulativeData} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="pipelineCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                  <stop offset="32%" stopColor={CHART_COLORS.stage2} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART_COLORS.stage2} stopOpacity={0.04} />
                </linearGradient>
                <filter id="pipelineAreaShadow" x="-20%" y="-20%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(15,23,42,0.2)" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={GRID_COLOR} />
              <XAxis dataKey="index" tick={{ fill: TEXT_MUTED }} />
              <YAxis tick={{ fill: TEXT_MUTED }} />
              <Tooltip content={<AdminChartTooltip unit={unitMode} />} />
                <Area
                  type="monotone"
                  dataKey={cumulativeKey}
                  stroke={CHART_COLORS.stage2}
                  strokeWidth={2}
                  fill="url(#pipelineCumulativeGradient)"
                  filter="url(#pipelineAreaShadow)"
                />
              </AreaChart>
            </ResponsiveContainer>
        </AdminChartCard>
      </div>

      <div className="col-12">
        <AdminChartCard title="Step Breakdown" subtitle="Raw diagnostics retained for detailed troubleshooting.">
          <table className="sa-step-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Step Label</th>
                <th>Duration</th>
                <th>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr key={step.index}>
                  <td>{step.index}</td>
                  <td>{step.label}</td>
                  <td>
                    <div>{formatSeconds(step.ms)}</div>
                    <small className="text-muted">{formatMs(step.ms)}</small>
                  </td>
                  <td>
                    {totalMs > 0 ? ((step.ms / totalMs) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminChartCard>
      </div>
    </div>
  );
}
