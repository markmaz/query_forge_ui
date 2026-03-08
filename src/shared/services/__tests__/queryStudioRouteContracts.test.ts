import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  fetchWorkspaceNamespaces,
  fetchWorkspaceUsers,
  runNoCodeQuery,
} from "../queryStudioAdminApi";
import { fetchDashboards, fetchEmbedUrl } from "../dashboards";

describe("query studio route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives workspace namespaces from workspace-tables and sends workspace header", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        rows: [
          { schema_name: "asset", catalog_name: "analytics" },
          { schema_name: "workboard", catalog_name: "analytics" },
          { schema_name: "asset", catalog_name: "analytics" },
          { schema_name: "directory", catalog_name: "catalog_2" },
        ],
      },
    });

    const result = await fetchWorkspaceNamespaces("ws-1");

    expect(mocks.get).toHaveBeenCalledWith("/domains/workspace-tables", {
      params: { limit: 5000, offset: 0 },
      headers: { "X-Workspace-Id": "ws-1" },
    });
    expect(result.schemas).toEqual(["asset", "workboard", "directory"]);
    expect(result.catalogs).toEqual(["analytics", "catalog_2"]);
  });

  it("uses /workspaces/:workspaceId/users for workspace user listing", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        rows: [{ user_id: "user-1", username: "user.one", email: "user1@example.com" }],
      },
    });

    const response = await fetchWorkspaceUsers("ws-88", { q: "john", limit: 20, offset: 40 });

    expect(mocks.get).toHaveBeenCalledWith("/workspaces/ws-88/users", {
      params: { q: "john", limit: 20, offset: 40 },
    });
    expect(response.rows).toHaveLength(1);
  });

  it("posts query execution requests to /query with mode and paging params", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        sql: "select 1",
        params: {},
        columns: [],
        rows: [],
        offset: 0,
      },
    });

    const result = await runNoCodeQuery(
      {
        version: 1,
        domainId: 1,
        columns: [],
        prompt: "",
        dataPrep: null,
        filters: null,
        aggs: null,
        sorting: [],
        distinct: false,
        value_overrides: { a: null, b: null, c: null },
        value_overrideAttachments: [],
        cohortAttachment: null,
      } as any,
      "preview",
      { limit: 50, offset: 100 }
    );

    expect(mocks.post).toHaveBeenCalledWith(
      "/query",
      expect.any(Object),
      expect.objectContaining({
        params: { mode: "preview", limit: 50, offset: 100 },
      })
    );
    expect(result.sql).toBe("select 1");
  });

  it("does not call removed dashboards listing endpoint", async () => {
    const result = await fetchDashboards();
    expect(result).toEqual([]);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("uses user-scoped dashboard embed route", async () => {
    mocks.get.mockResolvedValueOnce({ data: { embed_url: "https://example.com/embed" } });
    const response = await fetchEmbedUrl("dash-1", "user-1", "ws-1");

    expect(mocks.get).toHaveBeenCalledWith("/users/user-1/workspaces/ws-1/dashboards/dash-1/embed");
    expect(response).toEqual({ embed_url: "https://example.com/embed" });
  });
});
