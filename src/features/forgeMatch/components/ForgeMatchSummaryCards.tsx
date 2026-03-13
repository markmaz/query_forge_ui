import type { ForgeMatchDashboardSummary } from "../hooks";

type Props = {
  counts: ForgeMatchDashboardSummary["counts"];
};

type StatCard = {
  key: string;
  label: string;
  value: number;
  tone: "default" | "good" | "warn" | "danger";
};

function StatTile({ card }: { card: StatCard }) {
  return (
    <div className={`fm-stat-card fm-stat-${card.tone}`}>
      <span>{card.label}</span>
      <strong>{card.value}</strong>
    </div>
  );
}

export default function ForgeMatchSummaryCards({ counts }: Props) {
  const cards: StatCard[] = [
    { key: "total", label: "Total", value: counts.total, tone: "default" },
    { key: "matched", label: "Matched", value: counts.matched, tone: "good" },
    { key: "ambiguous", label: "Ambiguous", value: counts.ambiguous, tone: "warn" },
    { key: "no-match", label: "No Confident Match", value: counts.noConfidentMatch, tone: "danger" },
    { key: "accepted", label: "Accepted", value: counts.accepted, tone: "good" },
    { key: "rejected", label: "Rejected", value: counts.rejected, tone: "danger" },
    { key: "needs-review", label: "Needs Review", value: counts.needsReview, tone: "warn" },
    { key: "manual", label: "Manual", value: counts.manual, tone: "default" },
    { key: "high", label: "High Confidence", value: counts.high, tone: "good" },
    { key: "medium", label: "Medium Confidence", value: counts.medium, tone: "warn" },
    { key: "low", label: "Low Confidence", value: counts.low, tone: "danger" },
  ];

  return (
    <section className="fm-card" aria-label="ForgeMatch summary metrics">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">4. Analysis Summary</h2>
          <p className="fm-card-subtitle">Triage distribution and review completion metrics for this mapping session.</p>
        </div>
      </div>

      <div className="fm-stat-grid">
        {cards.map((card) => (
          <StatTile key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
