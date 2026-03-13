import { useMemo } from "react";

import type { ForgeMatchMapping, ForgeMatchSessionRecord } from "../types";

export type ForgeMatchWorkflowStep = "upload" | "extract" | "analyze" | "review" | "finalize";

type Input = {
  session: ForgeMatchSessionRecord | null;
  mappings: ForgeMatchMapping[];
  isAnalyzing: boolean;
};

export type ForgeMatchSessionView = {
  step: ForgeMatchWorkflowStep;
  stepIndex: number;
  statusLabel: "uploaded" | "analyzing" | "analyzed" | "in review" | "finalized" | "error" | null;
  allReviewed: boolean;
};

const STEP_ORDER: ForgeMatchWorkflowStep[] = ["upload", "extract", "analyze", "review", "finalize"];

export function useForgeMatchSession({ session, mappings, isAnalyzing }: Input): ForgeMatchSessionView {
  return useMemo(() => {
    if (!session) {
      return {
        step: "upload",
        stepIndex: STEP_ORDER.indexOf("upload"),
        statusLabel: null,
        allReviewed: false,
      };
    }

    const hasExtraction = Number(session.source_record_count ?? 0) > 0;
    const hasMappings = mappings.length > 0;
    const allReviewed = hasMappings && mappings.every((row) => row.status !== "suggested");

    let step: ForgeMatchWorkflowStep = "upload";

    if (allReviewed) {
      step = "finalize";
    } else if (hasMappings || session.status === "analyzed") {
      step = "review";
    } else if (isAnalyzing || session.status === "analyzing") {
      step = "analyze";
    } else if (hasExtraction || session.status === "uploaded") {
      step = "extract";
    }

    let statusLabel: ForgeMatchSessionView["statusLabel"];
    if (session.status === "error") {
      statusLabel = "error";
    } else if (allReviewed) {
      statusLabel = "finalized";
    } else if (hasMappings) {
      statusLabel = "in review";
    } else if (session.status === "analyzing" || isAnalyzing) {
      statusLabel = "analyzing";
    } else if (session.status === "analyzed") {
      statusLabel = "analyzed";
    } else {
      statusLabel = "uploaded";
    }

    return {
      step,
      stepIndex: STEP_ORDER.indexOf(step),
      statusLabel,
      allReviewed,
    };
  }, [isAnalyzing, mappings, session]);
}
