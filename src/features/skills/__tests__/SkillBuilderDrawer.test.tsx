import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as skillsApi from "../api";
import { createDefaultAction, createDefaultTrigger, SKILL_TEMPLATES } from "../constants";
import SkillBuilderDrawer from "../components/SkillBuilderDrawer";

describe("SkillBuilderDrawer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves progress from template with query context", async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    const onSaveSkill = vi.fn().mockResolvedValue(undefined);

    render(
      <SkillBuilderDrawer
        open={true}
        mode="create"
        skill={null}
        workspaceId="ws-1"
        queryContext={{ queryId: "q1", queryName: "Revenue Query" }}
        queryOptions={[{ id: "q1", name: "Revenue Query" }]}
        templates={SKILL_TEMPLATES}
        runs={[]}
        onClose={() => undefined}
        onSaveDraft={onSaveDraft}
        onSaveSkill={onSaveSkill}
      />
    );

    await user.click(screen.getByRole("button", { name: /daily ai summary/i }));
    await user.clear(screen.getByPlaceholderText(/skill name/i));
    await user.type(screen.getByPlaceholderText(/skill name/i), "Morning Digest");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Morning Digest",
        queryId: "q1",
      })
    );
    expect(onSaveSkill).not.toHaveBeenCalled();
  });

  it("shows backend-backed schedule validation and health", async () => {
    const user = userEvent.setup();
    vi.spyOn(skillsApi, "getSkillSchedulerHealth").mockResolvedValue({
      healthy: true,
      reason: null,
      lastDispatchAt: null,
      secondsSinceDispatch: 20,
    });
    vi.spyOn(skillsApi, "getSkillScheduleUpcoming").mockResolvedValue({
      upcoming: [],
      cronExpression: null,
      timezone: null,
      reason: null,
    });
    vi.spyOn(skillsApi, "validateSkillSchedule").mockResolvedValue({
      valid: true,
      errors: [],
      upcoming: ["2026-03-21T08:00:00-05:00"],
      cronExpression: "0 8 * * *",
      timezone: "America/Chicago",
    });

    render(
      <SkillBuilderDrawer
        open={true}
        mode="create"
        skill={null}
        workspaceId="ws-1"
        queryContext={{ queryId: "q1", queryName: "Revenue Query" }}
        queryOptions={[{ id: "q1", name: "Revenue Query" }]}
        templates={SKILL_TEMPLATES}
        runs={[]}
        onClose={() => undefined}
        onSaveDraft={vi.fn().mockResolvedValue(undefined)}
        onSaveSkill={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole("button", { name: /schedule/i }));

    expect(await screen.findByText("Scheduler")).toBeInTheDocument();
    expect(await screen.findByText("Online")).toBeInTheDocument();
    expect(await screen.findByText("Valid")).toBeInTheDocument();
    expect(await screen.findByText("2026-03-21T08:00:00-05:00")).toBeInTheDocument();
  });

  it("shows persisted schedule details in edit mode", async () => {
    const user = userEvent.setup();

    vi.spyOn(skillsApi, "getSkillSchedulerHealth").mockResolvedValue({
      healthy: true,
      reason: null,
      lastDispatchAt: null,
      secondsSinceDispatch: 20,
    });
    vi.spyOn(skillsApi, "getSkillScheduleUpcoming").mockResolvedValue({
      upcoming: ["2026-03-22T08:00:00-05:00"],
      cronExpression: "0 8 * * *",
      timezone: "America/Chicago",
      reason: null,
    });
    vi.spyOn(skillsApi, "validateSkillSchedule").mockResolvedValue({
      valid: true,
      errors: [],
      upcoming: ["2026-03-22T08:00:00-05:00"],
      cronExpression: "0 8 * * *",
      timezone: "America/Chicago",
    });

    render(
      <SkillBuilderDrawer
        open={true}
        mode="edit"
        skill={{
          id: "skill-1",
          name: "Daily Digest",
          description: "desc",
          queryId: "q1",
          queryName: "Revenue Query",
          skillType: "email_report",
          status: "active",
          trigger: createDefaultTrigger("schedule"),
          conditions: [],
          actions: [createDefaultAction("email_report")],
          createdAt: null,
          updatedAt: null,
          lastRunAt: null,
          runCount: 0,
          errorMessage: null,
        }}
        workspaceId="ws-1"
        queryContext={{ queryId: "q1", queryName: "Revenue Query" }}
        queryOptions={[{ id: "q1", name: "Revenue Query" }]}
        templates={SKILL_TEMPLATES}
        runs={[]}
        onClose={() => undefined}
        onSaveDraft={vi.fn().mockResolvedValue(undefined)}
        onSaveSkill={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole("button", { name: /schedule/i }));

    expect(await screen.findByText("Saved schedule")).toBeInTheDocument();
    expect(await screen.findByText("Saved cron:")).toBeInTheDocument();
    expect(await screen.findByText("2026-03-22T08:00:00-05:00")).toBeInTheDocument();
  });

  it("lets you switch from runs back to builder", async () => {
    const user = userEvent.setup();

    render(
      <SkillBuilderDrawer
        open={true}
        mode="edit"
        initialTab="runs"
        skill={{
          id: "skill-1",
          name: "Daily Digest",
          description: "desc",
          queryId: "q1",
          queryName: "Revenue Query",
          skillType: "email_report",
          status: "active",
          trigger: createDefaultTrigger("schedule"),
          conditions: [],
          actions: [createDefaultAction("email_report")],
          createdAt: null,
          updatedAt: null,
          lastRunAt: null,
          runCount: 0,
          errorMessage: null,
        }}
        workspaceId="ws-1"
        queryContext={{ queryId: "q1", queryName: "Revenue Query" }}
        queryOptions={[{ id: "q1", name: "Revenue Query" }]}
        templates={SKILL_TEMPLATES}
        runs={[]}
        onClose={() => undefined}
        onSaveDraft={vi.fn().mockResolvedValue(undefined)}
        onSaveSkill={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Run Details")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Builder" }));

    expect(await screen.findByText("Basic Setup")).toBeInTheDocument();
  });
});
