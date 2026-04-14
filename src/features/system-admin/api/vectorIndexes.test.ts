import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  rebuildAll,
  rebuildSemanticConcepts,
  reindexDomainVectors,
} from "./vectorIndexes";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    post: mocks.post,
  },
}));

describe("vectorIndexes api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rebuilds semantic concepts without a vertical payload", async () => {
    mocks.post.mockResolvedValue({
      data: {
        result: { conceptPoints: 10, aliasPoints: 5 },
      },
    });

    const response = await rebuildSemanticConcepts({});

    expect(mocks.post).toHaveBeenCalledWith("/admin/vector/semantic-concepts/rebuild", {});
    expect(response.result).toEqual({ conceptPoints: 10, aliasPoints: 5 });
  });

  it("reindexes domain vectors without a vertical payload", async () => {
    mocks.post.mockResolvedValue({
      data: {
        result: { upserted: 3, skipped: 1, total: 4 },
      },
    });

    const response = await reindexDomainVectors({});

    expect(mocks.post).toHaveBeenCalledWith("/admin/vector/domains/reindex", {});
    expect(response.result).toEqual({ upserted: 3, skipped: 1, total: 4 });
  });

  it("rebuilds all indexes without a vertical payload", async () => {
    mocks.post.mockResolvedValue({
      data: {
        status: "completed",
        results: {},
        errors: {},
        workspace_id: "ws-1",
      },
    });

    const response = await rebuildAll({ force: true });

    expect(mocks.post).toHaveBeenCalledWith("/admin/vector/rebuild-all", { force: true });
    expect(response.workspace_id).toBe("ws-1");
  });
});
