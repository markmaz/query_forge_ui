import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HealthCheck, HealthHistoryEntry } from "@/features/system-admin/types";
import AdminChartCard from "@/features/admin/charts/AdminChartCard";
import AdminChartTooltip from "@/features/admin/charts/AdminChartTooltip";
import { CHART_COLORS, GRID_COLOR, TEXT_MUTED, TEXT_PRIMARY, latencyColor } from "@/features/admin/charts/AdminChartTheme";

interface LatencyChartProps {
  checks: HealthCheck["checks"];
  history?: HealthHistoryEntry[];
}

type ServiceLatencyRow = {
  name: "MySQL" | "vLLM" | "Qdrant";
  latency_ms: number;
  status: "ok" | "error";
};

function severityFor(row: ServiceLatencyRow): "ok" | "warn" | "err" {
  if (row.status !== "ok") return "err";
  const color = latencyColor(row.latency_ms);
  if (color === CHART_COLORS.ok) return "ok";
  if (color === CHART_COLORS.warn) return "warn";
  return "err";
}

function formatHistoryTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" });
}

function latencyGradientId(ms: number): string {
  const color = latencyColor(ms);
  if (color === CHART_COLORS.ok) return "latencyGradOk";
  if (color === CHART_COLORS.warn) return "latencyGradWarn";
  return "latencyGradErr";
}

function donutGradientId(name: string): string {
  if (name === "Healthy") return "latencyDonutOk";
  if (name === "Warning") return "latencyDonutWarn";
  return "latencyDonutErr";
}

export default function LatencyChart({ checks, history = [] }: LatencyChartProps) {
  const serviceRows: ServiceLatencyRow[] = [
    { name: "MySQL", latency_ms: checks.mysql.latency_ms ?? 0, status: checks.mysql.status },
    { name: "vLLM", latency_ms: checks.vllm.latency_ms ?? 0, status: checks.vllm.status },
    { name: "Qdrant", latency_ms: checks.qdrant.latency_ms ?? 0, status: checks.qdrant.status },
  ];

  const counts = serviceRows.reduce(
    (acc, row) => {
      const severity = severityFor(row);
      acc[severity] += 1;
      return acc;
    },
    { ok: 0, warn: 0, err: 0 }
  );

  const donutData = [
    { name: "Healthy", value: counts.ok, fill: CHART_COLORS.ok },
    { name: "Warning", value: counts.warn, fill: CHART_COLORS.warn },
    { name: "Error", value: counts.err, fill: CHART_COLORS.err },
  ].filter((item) => item.value > 0);

  const healthyCount = serviceRows.filter((row) => row.status === "ok").length;
  const trendData = history.map((entry) => ({
    time: formatHistoryTime(entry.timestamp),
    mysql: entry.data.checks.mysql.latency_ms ?? null,
    vllm: entry.data.checks.vllm.latency_ms ?? null,
    qdrant: entry.data.checks.qdrant.latency_ms ?? null,
  }));

  return (
    <div className="row g-4 mb-4">
      <div className="col-12 col-xl-8">
        <AdminChartCard title="Service Latency" subtitle="Live endpoint latency by service (ms).">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={serviceRows} layout="vertical" margin={{ top: 6, right: 14, left: 8, bottom: 6 }}>
              <defs>
                <linearGradient id="latencyGradOk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#86efac" stopOpacity={0.5} />
                  <stop offset="55%" stopColor="#4ade80" stopOpacity={0.46} />
                  <stop offset="100%" stopColor="#15803d" stopOpacity={0.54} />
                </linearGradient>
                <linearGradient id="latencyGradWarn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fcd34d" stopOpacity={0.52} />
                  <stop offset="55%" stopColor="#f59e0b" stopOpacity={0.46} />
                  <stop offset="100%" stopColor="#b45309" stopOpacity={0.54} />
                </linearGradient>
                <linearGradient id="latencyGradErr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fca5a5" stopOpacity={0.5} />
                  <stop offset="55%" stopColor="#ef4444" stopOpacity={0.46} />
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.54} />
                </linearGradient>
                <filter id="latencyBarShadow" x="-30%" y="-30%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="rgba(2,6,23,0.45)" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fill: TEXT_MUTED }} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fill: TEXT_PRIMARY }} />
              <ReferenceLine x={100} stroke={CHART_COLORS.warn} strokeDasharray="4 4" />
              <ReferenceLine x={500} stroke={CHART_COLORS.err} strokeDasharray="4 4" />
              <Tooltip content={<AdminChartTooltip unit="ms" title="Latency" />} />
              <Bar
                dataKey="latency_ms"
                radius={[0, 10, 10, 0]}
                barSize={24}
                background={{ fill: "rgba(148,163,184,0.14)", radius: [0, 10, 10, 0] }}
                filter="url(#latencyBarShadow)"
              >
                {serviceRows.map((row) => (
                  <Cell key={row.name} fill={`url(#${latencyGradientId(row.latency_ms)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>
      </div>

      <div className="col-12 col-xl-4">
        <AdminChartCard title="Health Mix" subtitle="Current service health distribution.">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <defs>
                <radialGradient id="latencyDonutOk" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#bbf7d0" />
                  <stop offset="55%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#15803d" />
                </radialGradient>
                <radialGradient id="latencyDonutWarn" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="55%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </radialGradient>
                <radialGradient id="latencyDonutErr" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fecaca" />
                  <stop offset="55%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#991b1b" />
                </radialGradient>
                <filter id="latencyDonutShadow" x="-20%" y="-20%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.4" floodColor="rgba(2,6,23,0.28)" />
                </filter>
              </defs>
              <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={98} paddingAngle={2}>
                {donutData.map((item) => (
                  <Cell key={item.name} fill={`url(#${donutGradientId(item.name)})`} filter="url(#latencyDonutShadow)" />
                ))}
              </Pie>
              <Tooltip content={<AdminChartTooltip unit="ms" title="Services" valueFormatter={(value) => `${value} service${value === 1 ? "" : "s"}`} />} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={TEXT_PRIMARY} fontSize={13} fontWeight={700}>
                {`Healthy ${healthyCount}/${serviceRows.length}`}
              </text>
            </PieChart>
          </ResponsiveContainer>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="admin-legend-chip">
              <span className="admin-legend-chip__dot" style={{ background: CHART_COLORS.ok }} />
              Healthy: {counts.ok}
            </span>
            <span className="admin-legend-chip">
              <span className="admin-legend-chip__dot" style={{ background: CHART_COLORS.warn }} />
              Warning: {counts.warn}
            </span>
            <span className="admin-legend-chip">
              <span className="admin-legend-chip__dot" style={{ background: CHART_COLORS.err }} />
              Error: {counts.err}
            </span>
          </div>
        </AdminChartCard>
      </div>

      {trendData.length > 1 ? (
        <div className="col-12">
          <AdminChartCard title="Latency Trend" subtitle="Recent latency history for core services.">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendMysqlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.stage1} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={CHART_COLORS.stage1} stopOpacity={0.06} />
                  </linearGradient>
                  <linearGradient id="trendVllmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.stage2} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={CHART_COLORS.stage2} stopOpacity={0.06} />
                  </linearGradient>
                  <linearGradient id="trendQdrantGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.stage6} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={CHART_COLORS.stage6} stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke={GRID_COLOR} />
                <XAxis dataKey="time" tick={{ fill: TEXT_MUTED }} />
                <YAxis tick={{ fill: TEXT_MUTED }} />
                <Tooltip content={<AdminChartTooltip unit="ms" />} />
                <Area type="monotone" dataKey="mysql" stroke={CHART_COLORS.stage1} strokeWidth={2} fill="url(#trendMysqlGrad)" />
                <Area type="monotone" dataKey="vllm" stroke={CHART_COLORS.stage2} strokeWidth={2} fill="url(#trendVllmGrad)" />
                <Area type="monotone" dataKey="qdrant" stroke={CHART_COLORS.stage6} strokeWidth={2} fill="url(#trendQdrantGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </AdminChartCard>
        </div>
      ) : null}
    </div>
  );
}
