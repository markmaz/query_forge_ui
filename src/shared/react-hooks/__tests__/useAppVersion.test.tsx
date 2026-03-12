import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetAppVersionCacheForTests, useAppVersion } from "../useAppVersion";
import { getAppVersion } from "../../services/appVersionApi";

vi.mock("../../services/appVersionApi", () => ({
  getAppVersion: vi.fn(),
}));

describe("useAppVersion", () => {
  beforeEach(() => {
    __resetAppVersionCacheForTests();
    vi.clearAllMocks();
  });

  it("returns version text on success", async () => {
    vi.mocked(getAppVersion).mockResolvedValueOnce({ version: "2.0.0", build: "build-12" });

    const { result } = renderHook(() => useAppVersion());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.versionText).toBe("2.0.0");
    expect(result.current.isError).toBe(false);
    expect(result.current.raw?.build).toBe("build-12");
  });

  it("returns unknown on failure", async () => {
    vi.mocked(getAppVersion).mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useAppVersion());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.versionText).toBe("unknown");
    expect(result.current.isError).toBe(true);
    expect(result.current.raw).toBeNull();
  });

  it("uses cached payload across repeated calls", async () => {
    vi.mocked(getAppVersion).mockResolvedValueOnce({ version: "3.1.4", commit: "abc" });

    const first = renderHook(() => useAppVersion());
    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
    });
    first.unmount();

    const second = renderHook(() => useAppVersion());

    expect(second.result.current.versionText).toBe("3.1.4");
    expect(second.result.current.isLoading).toBe(false);
    expect(vi.mocked(getAppVersion)).toHaveBeenCalledTimes(1);
  });
});
