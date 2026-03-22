import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSkill,
  getSkillScheduleUpcoming,
  getSkillSchedulerHealth,
  listSkillRuns,
  listSkills,
  updateSkill,
  validateSkillSchedule,
} from "../api";
import { createDefaultAction, createDefaultCondition, createDefaultTrigger } from "../constants";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    patch: mocks.patch,
  },
}));

describe("skills api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes list filters and normalizes rows", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: "s1",
            name: "Revenue Alert",
            query_id: "q1",
            query_name: "Revenue Query",
            status: "active",
            skill_type: "threshold_alert",
            trigger: { id: "t1", kind: "trigger", type: "schedule", config: {} },
            conditions: [],
            actions: [{ id: "a1", kind: "action", type: "email_report", config: {} }],
          },
        ],
        total: 1,
      },
    });

    const result = await listSkills({ q: " rev ", status: "active", skillType: "threshold_alert" });

    expect(mocks.get).toHaveBeenCalledWith("/skills", {
      params: {
        q: "rev",
        status: "active",
        skill_type: "threshold_alert",
      },
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.name).toBe("Revenue Alert");
  });

  it("serializes create payload with workflow blocks", async () => {
    mocks.post.mockResolvedValue({
      data: {
        id: "s-new",
        name: "New Skill",
        status: "draft",
        trigger: { id: "t1", kind: "trigger", type: "schedule", config: {} },
        actions: [{ id: "a1", kind: "action", type: "email_report", config: {} }],
        conditions: [],
      },
    });

    await createSkill({
      name: "New Skill",
      description: null,
      queryId: "q1",
      queryName: "My Query",
      skillType: "email_report",
      status: "draft",
      trigger: createDefaultTrigger("schedule"),
      conditions: [createDefaultCondition("metric_threshold")],
      actions: [createDefaultAction("email_report")],
    });

    const [, payload] = mocks.post.mock.calls[0] ?? [];
    expect(mocks.post).toHaveBeenCalledWith("/skills", expect.any(Object));
    expect(payload).toMatchObject({
      name: "New Skill",
      query_id: "q1",
      workflow: expect.any(Array),
    });
  });

  it("serializes destination-backed slack actions without stale webhook fields", async () => {
    mocks.post.mockResolvedValue({
      data: {
        id: "s-new",
        name: "Slack Skill",
        status: "draft",
        trigger: { id: "t1", kind: "trigger", type: "schedule", config: {} },
        actions: [{ id: "a1", kind: "action", type: "slack_delivery", config: {} }],
        conditions: [],
      },
    });

    const action = createDefaultAction("slack_delivery");
    action.config = {
      ...action.config,
      destination_id: 17,
      webhook_url: "https://hooks.slack.com/services/old",
      delivery_target_mode: "destination",
    };

    await createSkill({
      name: "Slack Skill",
      description: null,
      queryId: "q1",
      queryName: "My Query",
      skillType: "slack_delivery",
      status: "draft",
      trigger: createDefaultTrigger("schedule"),
      conditions: [],
      actions: [action],
    });

    const [, payload] = mocks.post.mock.calls.at(-1) ?? [];
    expect(payload.actions[0].config).toMatchObject({
      destination_id: 17,
      webhook_url: "",
    });
    expect(payload.actions[0].config.delivery_target_mode).toBeUndefined();
  });

  it("falls back to patch update when put fails", async () => {
    mocks.put.mockRejectedValue(new Error("PUT not supported"));
    mocks.patch.mockResolvedValue({
      data: {
        id: "s1",
        name: "Updated",
        status: "active",
        trigger: { id: "t1", kind: "trigger", type: "schedule", config: {} },
        conditions: [],
        actions: [{ id: "a1", kind: "action", type: "email_report", config: {} }],
      },
    });

    const result = await updateSkill("s1", {
      name: "Updated",
      description: null,
      queryId: "q1",
      queryName: "My Query",
      skillType: "email_report",
      status: "active",
      trigger: createDefaultTrigger("schedule"),
      conditions: [],
      actions: [createDefaultAction("email_report")],
    });

    expect(mocks.put).toHaveBeenCalled();
    expect(mocks.patch).toHaveBeenCalled();
    expect(result.name).toBe("Updated");
  });

  it("returns empty run history when endpoint unavailable", async () => {
    mocks.get.mockRejectedValue(new Error("not found"));

    const runs = await listSkillRuns("s1");

    expect(runs).toEqual([]);
  });

  it("normalizes run details including result payload and error message", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "run-1",
            skill_id: "skill-1",
            status: "skipped",
            started_at: "2026-03-22T01:00:00Z",
            finished_at: "2026-03-22T01:00:01Z",
            created_at: "2026-03-22T00:59:59Z",
            duration_ms: 1000,
            message: "No rows returned — webhook skipped (send_if_empty=False).",
            error_message: null,
            triggered_by: "user-1",
            job_id: "job-1",
            schedule_id: null,
            result_json: {
              success: true,
              data: { skipped: true, row_count: 0 },
            },
            events: [],
          },
        ],
      },
    });

    const runs = await listSkillRuns("skill-1");

    expect(runs[0]).toMatchObject({
      id: "run-1",
      status: "skipped",
      createdAt: "2026-03-22T00:59:59Z",
      triggeredBy: "user-1",
      jobId: "job-1",
      errorMessage: null,
      result: {
        success: true,
        data: { skipped: true, row_count: 0 },
      },
    });
  });

  it("parses envelope with data array and normalizes active/email_delivery rows", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: [
          {
            id: "s-legacy",
            name: "Legacy Delivery",
            skill_type: "email_delivery",
            is_active: 1,
            config_json: {
              recipients: ["ops@example.com"],
              include_summary: true,
            },
            query_id: null,
            created_at: "2026-03-13T21:01:52",
            updated_at: null,
          },
        ],
        page: 1,
        page_size: 20,
        total: 1,
      },
    });

    const result = await listSkills();

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.status).toBe("active");
    expect(result.rows[0]?.skillType).toBe("email_report");
  });

  it("normalizes timezone-less UTC timestamps for skills and runs", async () => {
    mocks.get
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: "s-time",
              name: "Timestamp Skill",
              skill_type: "email_delivery",
              is_active: 1,
              config_json: {},
              last_run_at: "2026-03-22T01:00:00",
              updated_at: "2026-03-22T01:05:00",
            },
          ],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: "run-time",
              skill_id: "s-time",
              status: "success",
              started_at: "2026-03-22T01:00:00",
              finished_at: "2026-03-22T01:00:01",
              created_at: "2026-03-22T00:59:59",
              duration_ms: 1000,
              message: "Run complete.",
              error_message: null,
              result_json: {},
              events: [],
            },
          ],
        },
      });

    const skills = await listSkills();
    const runs = await listSkillRuns("s-time");

    expect(skills.rows[0]?.lastRunAt).toBe("2026-03-22T01:00:00Z");
    expect(skills.rows[0]?.updatedAt).toBe("2026-03-22T01:05:00Z");
    expect(runs[0]?.startedAt).toBe("2026-03-22T01:00:00Z");
    expect(runs[0]?.finishedAt).toBe("2026-03-22T01:00:01Z");
    expect(runs[0]?.createdAt).toBe("2026-03-22T00:59:59Z");
  });

  it("validates a schedule trigger via the backend helper", async () => {
    mocks.post.mockResolvedValue({
      data: {
        valid: true,
        errors: [],
        upcoming: ["2026-03-20T08:15:00-05:00"],
        cron_expression: "15 8 * * 5",
        timezone: "America/Chicago",
      },
    });

    const result = await validateSkillSchedule({
      ...createDefaultTrigger("schedule"),
      config: {
        frequency: "weekly",
        day_of_week: "friday",
        time: "08:15",
        timezone: "America/Chicago",
      },
    });

    expect(mocks.post).toHaveBeenCalledWith("/skills/schedule/validate", {
      trigger: expect.objectContaining({
        type: "schedule",
        config: expect.objectContaining({ frequency: "weekly" }),
      }),
    });
    expect(result.valid).toBe(true);
    expect(result.cronExpression).toBe("15 8 * * 5");
  });

  it("loads scheduler health", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        healthy: true,
        reason: null,
        last_dispatch_at: "2026-03-19T19:00:00+00:00",
        seconds_since_dispatch: 24,
      },
    });

    const result = await getSkillSchedulerHealth();

    expect(mocks.get).toHaveBeenCalledWith("/skills/scheduler/status");
    expect(result.healthy).toBe(true);
    expect(result.secondsSinceDispatch).toBe(24);
  });

  it("loads persisted schedule upcoming runs", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        upcoming: ["2026-03-21T08:00:00-05:00"],
        cron_expr: "0 8 * * *",
        timezone: "America/Chicago",
        reason: null,
      },
    });

    const result = await getSkillScheduleUpcoming("s1");

    expect(mocks.get).toHaveBeenCalledWith("/skills/s1/schedule/upcoming");
    expect(result.cronExpression).toBe("0 8 * * *");
    expect(result.upcoming).toEqual(["2026-03-21T08:00:00-05:00"]);
  });
});
