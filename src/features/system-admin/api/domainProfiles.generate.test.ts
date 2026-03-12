import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAllDomainProfiles,
  generateDomainProfile,
  generateDomainProfilesBatch,
} from "./domainProfiles";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getApiWorkspaceId: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    delete: mocks.delete,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

describe("domainProfiles generate API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiWorkspaceId.mockReturnValue("ws-123");
  });

  it("calls single generate endpoint with force payload and workspace header", async () => {
    mocks.post.mockResolvedValue({ data: { result: { domain_id: 7, status: "generated" } } });

    const response = await generateDomainProfile(7, { force: true });

    expect(mocks.post).toHaveBeenCalledWith(
      "/domain-profiles/7/generate",
      { force: true },
      {
        headers: {
          "X-Workspace-Id": "ws-123",
        },
      },
    );
    expect(response).toEqual({ result: { domain_id: 7, status: "generated" } });
  });

  it("calls batch generate endpoint with domain ids", async () => {
    mocks.post.mockResolvedValue({ data: { total: 2, generated: 1, unchanged: 1, failed: 0 } });

    await generateDomainProfilesBatch({ domain_ids: [7, 8], force: false });

    expect(mocks.post).toHaveBeenCalledWith(
      "/domain-profiles/generate",
      {
        domain_ids: [7, 8],
        force: false,
      },
      {
        headers: {
          "X-Workspace-Id": "ws-123",
        },
      },
    );
  });

  it("calls generate-all endpoint with include_inactive and force flags", async () => {
    mocks.post.mockResolvedValue({ data: { total: 10, generated: 10, unchanged: 0, failed: 0 } });

    await generateAllDomainProfiles({ force: true, include_inactive: true });

    expect(mocks.post).toHaveBeenCalledWith(
      "/domain-profiles/generate-all",
      {
        force: true,
        include_inactive: true,
      },
      {
        headers: {
          "X-Workspace-Id": "ws-123",
        },
      },
    );
  });

  it("surfaces backend error strings from failed responses", async () => {
    mocks.post.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: "Domain profile generation failed.",
        },
      },
      isAxiosError: true,
    });

    await expect(generateDomainProfile(11, { force: false })).rejects.toThrow(
      "Domain profile generation failed.",
    );
  });
});
