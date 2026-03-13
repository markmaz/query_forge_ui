import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartDatum = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type DistributionDatum = {
  label: string;
  value: number;
};

type Props = {
  confidenceData: ChartDatum[];
  outcomeData: ChartDatum[];
  domainData: DistributionDatum[];
};

function hasValues(data: { value: number }[]): boolean {
  return data.some((entry) => entry.value > 0);
}

export default function ForgeMatchCharts({ confidenceData, outcomeData, domainData }: Props) {
  const canRenderCharts = typeof window !== "undefined" && "ResizeObserver" in window;

  return (
    <section className="fm-chart-grid" aria-label="ForgeMatch chart dashboard">
      <div className="fm-card fm-chart-card">
        <h3 className="fm-chart-title">Confidence Distribution</h3>
        {canRenderCharts && hasValues(confidenceData) ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={confidenceData} dataKey="value" nameKey="label" innerRadius={54} outerRadius={80} paddingAngle={2}>
                {confidenceData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value} fields`} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="fm-chart-empty">
            {hasValues(confidenceData) ? "Chart preview unavailable in this environment." : "No confidence data yet."}
          </p>
        )}
        <div className="fm-chart-legend">
          {confidenceData.map((entry) => (
            <span key={entry.key} className="fm-chart-chip">
              <span className="fm-chart-dot" style={{ background: entry.color }} />
              {entry.label}: {entry.value}
            </span>
          ))}
        </div>
      </div>

      <div className="fm-card fm-chart-card">
        <h3 className="fm-chart-title">Match Outcome</h3>
        {canRenderCharts && hasValues(outcomeData) ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={outcomeData} dataKey="value" nameKey="label" innerRadius={54} outerRadius={80} paddingAngle={2}>
                {outcomeData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value} fields`} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="fm-chart-empty">
            {hasValues(outcomeData) ? "Chart preview unavailable in this environment." : "No match outcomes yet."}
          </p>
        )}
        <div className="fm-chart-legend">
          {outcomeData.map((entry) => (
            <span key={entry.key} className="fm-chart-chip">
              <span className="fm-chart-dot" style={{ background: entry.color }} />
              {entry.label}: {entry.value}
            </span>
          ))}
        </div>
      </div>

      <div className="fm-card fm-chart-card">
        <h3 className="fm-chart-title">Domain/Table Distribution</h3>
        {canRenderCharts && domainData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={domainData} layout="vertical" margin={{ top: 8, right: 20, left: 2, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `${value} fields`} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#1d4ed8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="fm-chart-empty">
            {domainData.length > 0 ? "Chart preview unavailable in this environment." : "No mapped domains yet."}
          </p>
        )}
      </div>
    </section>
  );
}
