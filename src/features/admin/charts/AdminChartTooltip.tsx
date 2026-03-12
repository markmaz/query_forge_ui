import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";
import { formatMs, formatSeconds, TEXT_MUTED, TEXT_PRIMARY } from "./AdminChartTheme";

type UnitMode = "ms" | "s";

interface AdminChartTooltipProps extends TooltipProps<number, string> {
  unit?: UnitMode;
  title?: ReactNode;
  valueFormatter?: (value: number) => string;
}

const formatValue = (value: number, unit: UnitMode) => {
  if (unit === "s") {
    return formatSeconds(value * 1000);
  }
  return formatMs(value);
};

export default function AdminChartTooltip({
  active,
  payload,
  label,
  unit = "ms",
  title,
  valueFormatter,
}: AdminChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="admin-chart-tooltip" role="presentation">
      <div className="admin-chart-tooltip__title">{title ?? label}</div>
      <div className="admin-chart-tooltip__rows">
        {payload.map((entry, index) => {
          const numericValue = Number(entry.value ?? 0);
          return (
            <div className="admin-chart-tooltip__row" key={`${entry.name}-${index}`}>
              <span className="admin-chart-tooltip__dot" style={{ backgroundColor: entry.color ?? TEXT_MUTED }} />
              <span style={{ color: TEXT_MUTED }}>{entry.name}</span>
              <span style={{ color: TEXT_PRIMARY }}>
                {valueFormatter ? valueFormatter(numericValue) : formatValue(numericValue, unit)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
