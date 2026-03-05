import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PipelineStep } from "@/features/system-admin/types";

interface StepChartProps {
  steps: PipelineStep[];
  totalMs: number;
}

const STEP_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#ef4444",
];

export default function StepChart({ steps, totalMs }: StepChartProps) {
  const barData = useMemo(() => {
    const row: Record<string, number | string> = { name: "Pipeline" };
    for (const step of steps) {
      row[step.label] = step.ms;
    }
    return [row];
  }, [steps]);

  const cumulativeOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const step of steps) {
      offsets.push(acc);
      acc += step.ms;
    }
    return offsets;
  }, [steps]);

  return (
    <>
      <div className="sa-chart-section">
        <div className="sa-chart-title">Stacked Duration</div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart layout="vertical" data={barData} stackOffset="none">
            <XAxis type="number" unit=" ms" />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip formatter={(value: number) => `${value} ms`} />
            {steps.map((step, i) => (
              <Bar
                key={step.label}
                dataKey={step.label}
                stackId="pipeline"
                fill={STEP_COLORS[i % STEP_COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="sa-chart-section">
        <div className="sa-chart-title">Waterfall</div>
        <div className="sa-waterfall">
          {steps.map((step, i) => {
            const leftPct =
              totalMs > 0 ? (cumulativeOffsets[i] / totalMs) * 100 : 0;
            const widthPct =
              totalMs > 0 ? (step.ms / totalMs) * 100 : 0;
            return (
              <div className="sa-waterfall-row" key={step.index}>
                <div className="sa-waterfall-label">{step.label}</div>
                <div className="sa-waterfall-track">
                  <div
                    className="sa-waterfall-bar"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: STEP_COLORS[i % STEP_COLORS.length],
                    }}
                    title={`${step.ms} ms`}
                  >
                    {widthPct > 8 ? `${step.ms}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sa-chart-section">
        <div className="sa-chart-title">Step Breakdown</div>
        <table className="sa-step-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Step Label</th>
              <th>Duration (ms)</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.index}>
                <td>{step.index}</td>
                <td>{step.label}</td>
                <td>{step.ms}</td>
                <td>
                  {totalMs > 0
                    ? ((step.ms / totalMs) * 100).toFixed(1)
                    : "0.0"}
                  %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
