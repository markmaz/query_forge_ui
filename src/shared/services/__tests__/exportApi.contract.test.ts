import { beforeEach, describe, expect, it, vi } from "vitest";

import { startExcelExport } from ".././exportApi";

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

describe("export API request contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends sqlJson export payload with fileName/signature", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    mocks.post.mockResolvedValue({
      data: {
        token: "token-1",
        fileName: "server-name.xlsx",
      },
    });
    mocks.get.mockResolvedValue({
      data: new Blob(["x"]),
      headers: {},
    });

    const sqlJson = { version: 1, domainId: 1, columns: [] } as any;
    await startExcelExport({ sqlJson, fileName: "client-name.xlsx", signature: "sig-1" });

    expect(mocks.post).toHaveBeenCalledWith("/exports/excel", {
      sqlJson,
      fileName: "client-name.xlsx",
      signature: "sig-1",
    });
    expect(mocks.get).toHaveBeenCalledWith("/exports/excel/token-1", { responseType: "blob" });

    clickSpy.mockRestore();
    revokeObjectURL.mockRestore();
    createObjectURL.mockRestore();
  });

  it("maps raw-sql export rejection to refresh message", async () => {
    mocks.post.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: "Raw SQL fields are not allowed in this endpoint: sql, countSql",
        },
      },
    });

    await expect(
      startExcelExport({
        sqlJson: { version: 1, domainId: 1, columns: [] } as any,
        fileName: "test.xlsx",
      })
    ).rejects.toThrow("Request format outdated, please refresh and try again.");
  });
});
