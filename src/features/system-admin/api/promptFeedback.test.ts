import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePromptFeedback,
  listPromptFeedback,
} from "./promptFeedback";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  delete: vi.fn(),
  getApiWorkspaceId: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    delete: mocks.delete,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

vi.mock("@/shared/runtime/accessTokenStore", () => ({
  getAccessToken: mocks.getAccessToken,
}));

describe("promptFeedback api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiWorkspaceId.mockReturnValue("ws-1");
    mocks.getAccessToken.mockReturnValue("token-abc");
  });

  it("calls list endpoint with query params and admin headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: 91,
            vote: "down",
            user_id: "user-7",
            trace_id: "trace-7",
            normalized_prompt: "normalized",
            prompt_text: "original prompt",
            created_at: "2026-03-06T10:40:52.120Z",
            updated_at: "2026-03-06T10:41:02.120Z",
          },
        ],
        total: 1,
        limit: 25,
        offset: 50,
      },
    });

    const response = await listPromptFeedback({
      limit: 25,
      offset: 50,
      vote: "down",
      user_id: " user-7 ",
      trace_id: " trace-7 ",
      include_payload: true,
    });

    expect(mocks.get).toHaveBeenCalledWith("/admin/prompt-feedback", {
      params: {
        limit: 25,
        offset: 50,
        vote: "down",
        user_id: "user-7",
        trace_id: "trace-7",
        include_payload: "true",
      },
      headers: {
        Authorization: "Bearer token-abc",
        "X-Workspace-Id": "ws-1",
      },
    });
    expect(response.total).toBe(1);
    expect(response.rows[0]).toMatchObject({
      id: 91,
      vote: "down",
      user_id: "user-7",
    });
  });

  it("supports include_payload=false shape and sends delete headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: 11,
            vote: "up",
            user_id: "user-1",
            trace_id: "trace-1",
            normalized_prompt: "prompt",
            prompt_text: "prompt",
            created_at: null,
            updated_at: null,
          },
        ],
      },
    });
    mocks.delete.mockResolvedValue({
      data: { deleted: true },
    });

    const listed = await listPromptFeedback({ include_payload: false });
    const deleted = await deletePromptFeedback(11);

    expect(mocks.get).toHaveBeenCalledWith("/admin/prompt-feedback", {
      params: {
        limit: 100,
        offset: 0,
        include_payload: "false",
      },
      headers: {
        Authorization: "Bearer token-abc",
        "X-Workspace-Id": "ws-1",
      },
    });
    expect(listed.rows[0]?.payload).toBeNull();

    expect(mocks.delete).toHaveBeenCalledWith("/admin/prompt-feedback/11", {
      headers: {
        Authorization: "Bearer token-abc",
        "X-Workspace-Id": "ws-1",
      },
    });
    expect(deleted).toEqual({ deleted: true });
  });
});
