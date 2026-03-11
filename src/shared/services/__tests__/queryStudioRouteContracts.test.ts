import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("../api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
  },
}));

import {
  createModelColumn,
  createDomain,
  fetchColumnSample,
  fetchDomainJoins,
  fetchWorkspaceNamespaces,
  fetchWorkspaceTables,
  fetchWorkspaceUsers,
  runNoCodeQuery,
  updateDomain,
} from "../queryStudioAdminApi";
import { fetchDashboards, fetchEmbedUrl } from "../dashboards";

describe("query studio route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses live workspace namespaces route", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        schemas: ["asset", "workboard", "asset", "directory"],
        catalogs: ["analytics", "analytics", "catalog_2"],
      },
    });

    const result = await fetchWorkspaceNamespaces("ws-1");

    expect(mocks.get).toHaveBeenCalledWith("/workspaces/ws-1/namespaces", {
      params: {},
    });
    expect(result.schemas).toEqual(["asset", "workboard", "directory"]);
    expect(result.catalogs).toEqual(["analytics", "catalog_2"]);
  });

  it("sends workspace header for workspace tables fetch", async () => {
    mocks.get.mockResolvedValueOnce({ data: { rows: [] } });

    await fetchWorkspaceTables({
      workspaceId: "ws-1",
      schema_name: "asset",
      limit: 25,
      offset: 0,
    });

    expect(mocks.get).toHaveBeenCalledWith("/domains/workspace-tables", {
      params: { schema_name: "asset", limit: 25, offset: 0 },
      headers: { "X-Workspace-Id": "ws-1" },
    });
  });

  it("forwards mapped workspace-table filter directly to backend", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        rows: [
          {
            workspace_table_id: 42,
            full_name: "dim_student",
            table_name: "dim_student",
            schema_name: "asset",
            catalog_name: "analytics",
            model_table_id: null,
            model_table_name: null,
            variant_code: null,
            is_qe: false,
          },
        ],
      },
    });

    const result = await fetchWorkspaceTables({
      workspaceId: "ws-1",
      mapped: true,
      limit: 50,
      offset: 0,
    });

    expect(mocks.get).toHaveBeenCalledWith("/domains/workspace-tables", {
      params: { mapped: true, limit: 50, offset: 0 },
      headers: { "X-Workspace-Id": "ws-1" },
    });
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        id: 42,
        workspace_table_id: 42,
        model_table_id: null,
        model_table_name: null,
      })
    );
  });

  it("sends workspace header for domain joins fetch", async () => {
    mocks.get.mockResolvedValueOnce({ data: { rows: [] } });

    await fetchDomainJoins(15, "ws-1");

    expect(mocks.get).toHaveBeenCalledWith("/domains/15/joins", {
      headers: { "X-Workspace-Id": "ws-1" },
    });
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

  it("never sends model_table_id on domain create/update payloads", async () => {
    mocks.post.mockResolvedValueOnce({ data: { row: { id: 7, name: "Enrollment" } } });
    mocks.patch.mockResolvedValueOnce({ data: { row: { id: 7, name: "Enrollment Updated" } } });

    await createDomain({
      name: "Enrollment",
      kind: "education",
      description: "test",
      model_table_id: 123,
      column_name_policy: "DEDUP_PRIMARY_FIRST",
    } as any);
    await updateDomain(7, {
      name: "Enrollment Updated",
      model_table_id: 456,
    } as any);

    expect(mocks.post).toHaveBeenCalledWith(
      "/domains",
      expect.not.objectContaining({
        model_table_id: expect.anything(),
      })
    );
    expect(mocks.patch).toHaveBeenCalledWith(
      "/domains/7",
      expect.not.objectContaining({
        model_table_id: expect.anything(),
      })
    );
  });

  it("creates model columns using tableName + columnName payload", async () => {
    mocks.post.mockResolvedValueOnce({ data: { row: { id: 101 } } });

    await createModelColumn({
      tableName: "dim_student",
      columnName: "race_ethnicity",
      dataType: "string",
      description: "Race",
      isActive: true,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/models/columns",
      expect.objectContaining({
        tableName: "dim_student",
        columnName: "race_ethnicity",
      })
    );
    expect(mocks.post).toHaveBeenCalledWith(
      "/models/columns",
      expect.not.objectContaining({
        model_table_id: expect.anything(),
      })
    );
  });

  it("rejects model-column create when tableName is missing", async () => {
    await expect(
      createModelColumn({
        tableName: " ",
        columnName: "race_ethnicity",
      } as any)
    ).rejects.toThrow("tableName is required");
    expect(mocks.post).not.toHaveBeenCalledWith("/models/columns", expect.anything());
  });

  it("loads workspace-backed column samples from /domains/column-sample", async () => {
    mocks.get.mockResolvedValueOnce({ data: { values: [], limit: 25 } });

    await fetchColumnSample({
      workspace_table_id: 24,
      column_name: "race_ethnicity",
      limit: 25,
    });

    expect(mocks.get).toHaveBeenCalledWith("/domains/column-sample", {
      params: {
        workspace_table_id: 24,
        column_name: "race_ethnicity",
        limit: 25,
      },
    });
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
