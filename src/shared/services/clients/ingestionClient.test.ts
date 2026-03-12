import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestionClient } from "./ingestionClient";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
  },
}));

describe("ingestionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls diagnostics endpoint with GET", async () => {
    mocks.get.mockResolvedValue({ data: { celery_state: "PENDING" } });

    await ingestionClient.getDiagnostics("job-123");

    expect(mocks.get).toHaveBeenCalledWith("/ingestion/diagnostics/job-123");
  });

  it("calls cancel endpoint with POST", async () => {
    mocks.post.mockResolvedValue({ data: { canceled: true } });

    await ingestionClient.cancelRun("job-456");

    expect(mocks.post).toHaveBeenCalledWith("/ingestion/cancel/job-456");
  });
});
