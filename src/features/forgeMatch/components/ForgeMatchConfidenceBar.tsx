import type { ForgeMatchConfidenceBand } from "@/shared/services/forgeMatch";

type Props = {
  score: number;
  band: ForgeMatchConfidenceBand;
};

function percentFromScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score <= 1) return Math.max(0, Math.min(100, Math.round(score * 100)));
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function ForgeMatchConfidenceBar({ score, band }: Props) {
  const pct = percentFromScore(score);

  return (
    <div className="fm-confidence-bar" role="img" aria-label={`Confidence ${pct}% ${band}`}>
      <div className={`fm-confidence-bar-fill fm-confidence-${band}`} style={{ width: `${pct}%` }} />
      <span className="fm-confidence-bar-label">{pct}%</span>
    </div>
  );
}
