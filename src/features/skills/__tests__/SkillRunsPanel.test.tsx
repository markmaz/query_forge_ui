import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SkillRunsPanel from "../components/SkillRunsPanel";
import type { SkillRun } from "../types";

const RUN: SkillRun = {
  id: "run-1",
  skillId: "skill-1",
  status: "skipped",
  startedAt: "2026-03-22T01:00:00Z",
  finishedAt: "2026-03-22T01:00:01Z",
  createdAt: "2026-03-22T00:59:59Z",
  durationMs: 1000,
  message: "No rows returned — webhook skipped (send_if_empty=False).",
  errorMessage: null,
  result: {
    success: true,
    data: { skipped: true, row_count: 0 },
  },
  triggeredBy: "user-1",
  jobId: "job-1",
  scheduleId: null,
  events: [],
};

describe("SkillRunsPanel", () => {
  it("shows run metadata and result payload for the selected run", () => {
    render(<SkillRunsPanel runs={[RUN]} />);

    expect(screen.getByText("Run Details")).toBeInTheDocument();
    expect(screen.getByText("Triggered By")).toBeInTheDocument();
    expect(screen.getByText("user-1")).toBeInTheDocument();
    expect(screen.getByText("Result Payload")).toBeInTheDocument();
    expect(screen.getByText(/"row_count": 0/)).toBeInTheDocument();
    expect(
      screen.getAllByText("No rows returned — webhook skipped (send_if_empty=False).").length,
    ).toBeGreaterThan(0);
  });
});
