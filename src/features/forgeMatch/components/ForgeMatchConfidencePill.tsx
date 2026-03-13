import type { ForgeMatchConfidenceBand } from "@/shared/services/forgeMatch";

type Props = {
  score: number;
  band: ForgeMatchConfidenceBand;
};

export default function ForgeMatchConfidencePill({ score, band }: Props) {
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return <span className={`fm-confidence-pill fm-confidence-${band}`}>{pct}% {band}</span>;
}
