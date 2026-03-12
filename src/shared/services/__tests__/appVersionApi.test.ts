import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppVersion } from "../appVersionApi";

describe("getAppVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns version payload on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "1.2.3", build: "abc123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = await getAppVersion();

    expect(payload.version).toBe("1.2.3");
    expect(payload.build).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/version/"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("throws a safe error when request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAppVersion()).rejects.toThrow(/Failed to fetch app version/i);
  });
});
