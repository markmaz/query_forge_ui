import { beforeEach, describe, expect, it, vi } from "vitest";

import { startExecution } from ".././executionsApi";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}));

vi.mock(".././api", () => ({
  default: {
    post: mocks.post,
    get: mocks.get,
  },
}));

describe("executions API request contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends sqlJson-only start payload", async () => {
    const sqlJson = { version: 1, domainId: 1, columns: [] } as any;
    mocks.post.mockResolvedValue({ data: { jobId: "job-1", statementId: "stmt-1" } });

    await startExecution({
      sqlJson,
      kind: "query_builder",
      limit: 200,
      offset: 0,
    });

    expect(mocks.post).toHaveBeenCalledWith("/executions/start", {
      sqlJson,
      kind: "query_builder",
      limit: 200,
      offset: 0,
    });
  });

  it("maps raw-sql rejection to refresh message", async () => {
    mocks.post.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: "Raw SQL fields are not allowed in this endpoint: sql, params",
        },
      },
    });

    await expect(
      startExecution({
        sqlJson: { version: 1, domainId: 1, columns: [] } as any,
        kind: "query_builder",
      })
    ).rejects.toThrow("Request format outdated, please refresh and try again.");
  });
});
