import { useMemo } from "react";

import type { ForgeMatchMapping } from "../types";

function priorityOf(row: ForgeMatchMapping): number {
  if (row.match_decision === "no_confident_match") return 0;
  if (row.match_decision === "ambiguous") return 1;
  if (row.confidence_band === "low") return 2;
  if (row.status === "needs_review") return 3;
  if (row.status === "suggested") return 4;
  if (row.status === "manually_mapped") return 5;
  if (row.status === "accepted") return 6;
  if (row.status === "rejected") return 7;
  return 8;
}

function safeScore(score: number): number {
  if (!Number.isFinite(score)) return 1000;
  return score;
}

export function useForgeMatchQueue(rows: ForgeMatchMapping[]): ForgeMatchMapping[] {
  return useMemo(() => {
    return [...rows].sort((a, b) => {
      const priorityDelta = priorityOf(a) - priorityOf(b);
      if (priorityDelta !== 0) return priorityDelta;

      const scoreDelta = safeScore(a.confidence_score) - safeScore(b.confidence_score);
      if (scoreDelta !== 0) return scoreDelta;

      const sourceA = String(a.source_field_name ?? a.mapping_id).toLowerCase();
      const sourceB = String(b.source_field_name ?? b.mapping_id).toLowerCase();
      return sourceA.localeCompare(sourceB);
    });
  }, [rows]);
}
