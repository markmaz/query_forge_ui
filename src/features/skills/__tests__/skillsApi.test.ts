import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSkill,
  listSkillRuns,
  listSkills,
  updateSkill,
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
});
