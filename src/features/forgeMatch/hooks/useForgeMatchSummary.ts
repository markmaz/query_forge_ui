import { useMemo } from "react";

import type { ForgeMatchMapping, ForgeMatchSummary } from "../types";

type SummaryCounts = {
  total: number;
  matched: number;
  ambiguous: number;
  noConfidentMatch: number;
  accepted: number;
  rejected: number;
  needsReview: number;
  manual: number;
  suggested: number;
  high: number;
  medium: number;
  low: number;
};

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

export type ForgeMatchDashboardSummary = {
  counts: SummaryCounts;
  triage: {
    ambiguous: number;
    noMatch: number;
    lowConfidence: number;
  };
  confidenceData: ChartDatum[];
  outcomeData: ChartDatum[];
  domainData: DistributionDatum[];
};

const CONFIDENCE_COLORS = {
  high: "#0f766e",
  medium: "#b45309",
  low: "#b91c1c",
};

const OUTCOME_COLORS = {
  matched: "#0f766e",
  ambiguous: "#b45309",
  no_confident_match: "#b91c1c",
};

function numberAt(source: Record<string, number> | undefined, key: string): number {
  return Number.isFinite(source?.[key]) ? Number(source?.[key]) : 0;
}

function emptyCounts(): SummaryCounts {
  return {
    total: 0,
    matched: 0,
    ambiguous: 0,
    noConfidentMatch: 0,
    accepted: 0,
    rejected: 0,
    needsReview: 0,
    manual: 0,
    suggested: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
}

function deriveCountsFromMappings(mappings: ForgeMatchMapping[]): SummaryCounts {
  const counts = emptyCounts();
  counts.total = mappings.length;

  mappings.forEach((row) => {
    if (row.match_decision === "matched") counts.matched += 1;
    if (row.match_decision === "ambiguous") counts.ambiguous += 1;
    if (row.match_decision === "no_confident_match") counts.noConfidentMatch += 1;

    if (row.status === "accepted") counts.accepted += 1;
    if (row.status === "rejected") counts.rejected += 1;
    if (row.status === "needs_review") counts.needsReview += 1;
    if (row.status === "manually_mapped") counts.manual += 1;
    if (row.status === "suggested") counts.suggested += 1;

    if (row.confidence_band === "high") counts.high += 1;
    if (row.confidence_band === "medium") counts.medium += 1;
    if (row.confidence_band === "low") counts.low += 1;
  });

  return counts;
}

function deriveCountsFromSummary(summary: ForgeMatchSummary | null): SummaryCounts {
  if (!summary) return emptyCounts();

  return {
    total: Number(summary.total ?? 0),
    matched: numberAt(summary.decision_counts, "matched"),
    ambiguous: numberAt(summary.decision_counts, "ambiguous"),
    noConfidentMatch: numberAt(summary.decision_counts, "no_confident_match"),
    accepted: numberAt(summary.status_counts, "accepted"),
    rejected: numberAt(summary.status_counts, "rejected"),
    needsReview: numberAt(summary.status_counts, "needs_review"),
    manual: numberAt(summary.status_counts, "manually_mapped"),
    suggested: numberAt(summary.status_counts, "suggested"),
    high: numberAt(summary.confidence_bands, "high"),
    medium: numberAt(summary.confidence_bands, "medium"),
    low: numberAt(summary.confidence_bands, "low"),
  };
}

function deriveDomainDistribution(mappings: ForgeMatchMapping[]): DistributionDatum[] {
  const buckets = new Map<string, number>();

  mappings.forEach((row) => {
    const domain = row.manual_selection?.table_name ?? row.best_match?.table_name ?? "Unmapped";
    const key = String(domain || "Unmapped").trim() || "Unmapped";
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  return [...buckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function useForgeMatchSummary(
  mappings: ForgeMatchMapping[],
  summary: ForgeMatchSummary | null
): ForgeMatchDashboardSummary {
  return useMemo(() => {
    const counts = mappings.length > 0 ? deriveCountsFromMappings(mappings) : deriveCountsFromSummary(summary);

    const triage = {
      ambiguous:
        mappings.length > 0
          ? mappings.filter((row) => row.match_decision === "ambiguous" && row.status !== "accepted").length
          : counts.ambiguous,
      noMatch:
        mappings.length > 0
          ? mappings.filter((row) => row.match_decision === "no_confident_match" && row.status !== "accepted").length
          : counts.noConfidentMatch,
      lowConfidence:
        mappings.length > 0
          ? mappings.filter((row) => row.confidence_band === "low" && row.status !== "accepted").length
          : counts.low,
    };

    return {
      counts,
      triage,
      confidenceData: [
        { key: "high", label: "High", value: counts.high, color: CONFIDENCE_COLORS.high },
        { key: "medium", label: "Medium", value: counts.medium, color: CONFIDENCE_COLORS.medium },
        { key: "low", label: "Low", value: counts.low, color: CONFIDENCE_COLORS.low },
      ],
      outcomeData: [
        { key: "matched", label: "Matched", value: counts.matched, color: OUTCOME_COLORS.matched },
        { key: "ambiguous", label: "Ambiguous", value: counts.ambiguous, color: OUTCOME_COLORS.ambiguous },
        {
          key: "no_confident_match",
          label: "No Match",
          value: counts.noConfidentMatch,
          color: OUTCOME_COLORS.no_confident_match,
        },
      ],
      domainData: deriveDomainDistribution(mappings),
    };
  }, [mappings, summary]);
}
