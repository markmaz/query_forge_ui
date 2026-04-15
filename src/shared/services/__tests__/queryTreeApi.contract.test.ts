import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}));

import { purgeSavedQuery } from "../queryTreeApi";

describe("queryTreeApi route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the saved-query purge route", async () => {
    mocks.delete.mockResolvedValueOnce({ data: { ok: true } });

    await purgeSavedQuery("query-123");

    expect(mocks.delete).toHaveBeenCalledWith("/saved-queries/query-123/purge");
  });
});
