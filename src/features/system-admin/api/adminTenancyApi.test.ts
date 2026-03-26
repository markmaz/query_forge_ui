import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bindWorkspace,
  bootstrapTenancy,
  createWorkspace,
  getDatasourceNamespaces,
  listOrganizations,
  listWorkspaceBindings,
  testDatasource,
  updateWorkspaceBinding,
} from "./adminTenancyApi";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  getApiWorkspaceId: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

vi.mock("@/shared/runtime/accessTokenStore", () => ({
  getAccessToken: mocks.getAccessToken,
}));

describe("adminTenancyApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiWorkspaceId.mockReturnValue("ws-101");
    mocks.getAccessToken.mockReturnValue("token-xyz");
  });

  it("serializes list organizations query params and headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            organization_id: 44,
            name: "Acme",
            slug: "acme",
            is_active: true,
          },
        ],
        total: 1,
        limit: 50,
        offset: 100,
      },
    });

    const result = await listOrganizations({
      q: " ac ",
      include_inactive: true,
      limit: 50,
      offset: 100,
    });

    expect(mocks.get).toHaveBeenCalledWith("/admin/organizations", {
      params: {
        q: "ac",
        include_inactive: "true",
        limit: 50,
        offset: 100,
      },
      headers: {
        Authorization: "Bearer token-xyz",
        "X-Workspace-Id": "ws-101",
      },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.organization_id).toBe("44");
    expect(result.total).toBe(1);
  });

  it("calls workspace bindings endpoint with organization filter", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            workspace_id: "w-1",
            workspace_name: "Workspace 1",
            organization_name: "Org A",
            datasource_name: "DS A",
            workspace_is_active: true,
          },
        ],
        total: 1,
      },
    });

    await listWorkspaceBindings({
      organization_id: "org-1",
      include_inactive: false,
      limit: 25,
      offset: 0,
    });

    expect(mocks.get).toHaveBeenCalledWith("/admin/workspaces", {
      params: {
        organization_id: "org-1",
        include_inactive: "false",
        limit: 25,
        offset: 0,
      },
      headers: {
        Authorization: "Bearer token-xyz",
        "X-Workspace-Id": "ws-101",
      },
    });
  });

  it("sends datasource test and binding patch payloads", async () => {
    mocks.post.mockResolvedValue({
      data: {
        success: true,
        status: "ok",
        latency_ms: 143,
        message: "connection succeeded",
        tested_at: "2026-03-10T12:00:00Z",
      },
    });
    mocks.patch.mockResolvedValue({
      data: {
        workspace_id: "w-1",
        workspace_name: "Workspace 1",
        organization_id: "org-4",
        datasource_id: "ds-4",
        datasource_name: "Datasource 4",
        datasource_type: "snowflake",
        workspace_is_active: true,
        default_catalog: "analytics",
        default_schema: "public",
      },
    });

    const testResult = await testDatasource("ds-9");
    const binding = await updateWorkspaceBinding("w-1", {
      organization_id: "org-4",
      datasource_id: "ds-4",
      default_catalog: "analytics",
      default_schema: "public",
      is_active: true,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/admin/datasources/ds-9/test",
      {},
      {
        headers: {
          Authorization: "Bearer token-xyz",
          "X-Workspace-Id": "ws-101",
        },
      }
    );

    expect(mocks.patch).toHaveBeenCalledWith(
      "/admin/workspaces/w-1/binding",
      {
        organization_id: "org-4",
        datasource_id: "ds-4",
        is_active: true,
        default_catalog: "analytics",
        default_schema: "public",
      },
      {
        headers: {
          Authorization: "Bearer token-xyz",
          "X-Workspace-Id": "ws-101",
        },
      }
    );

    expect(testResult.success).toBe(true);
    expect(binding.default_schema).toBe("public");
  });

  it("loads datasource namespaces with optional catalog", async () => {
    mocks.get.mockResolvedValue({
      data: {
        datasource_id: "ds-9",
        datasource_type: "snowflake",
        catalogs: ["ANALYTICS", "RAW"],
        schemas: ["PUBLIC", "REPORTING"],
        current_catalog: "ANALYTICS",
        current_schema: "PUBLIC",
      },
    });

    const result = await getDatasourceNamespaces("ds-9", "ANALYTICS");

    expect(mocks.get).toHaveBeenCalledWith("/admin/datasources/ds-9/namespaces", {
      params: { catalog: "ANALYTICS" },
      headers: {
        Authorization: "Bearer token-xyz",
        "X-Workspace-Id": "ws-101",
      },
    });
    expect(result.catalogs).toEqual(["ANALYTICS", "RAW"]);
    expect(result.schemas).toEqual(["PUBLIC", "REPORTING"]);
  });

  it("parses wrapped datasource test result payload and infers success from status", async () => {
    mocks.post.mockResolvedValue({
      data: {
        result: {
          datasource_id: 1,
          type: "snowflake",
          status: "ok",
          latency_ms: 1197,
          message: "connection ok",
        },
      },
    });

    const testResult = await testDatasource("ds-1");

    expect(testResult.status).toBe("ok");
    expect(testResult.success).toBe(true);
    expect(testResult.latency_ms).toBe(1197);
    expect(testResult.message).toBe("connection ok");
  });

  it("posts create workspace payload", async () => {
    mocks.post.mockResolvedValue({
      data: {
        workspace_id: "ws-222",
        workspace_name: "Acme Workspace",
        organization_id: "org-44",
        organization_name: "Acme Org",
        datasource_id: null,
        datasource_name: null,
        datasource_type: null,
        workspace_is_active: true,
        description: "Workspace created for onboarding",
        default_catalog: "ANALYTICS",
        default_schema: "PUBLIC",
      },
    });

    const result = await createWorkspace({
      workspace_id: "ws-222",
      organization_id: "org-44",
      name: "Acme Workspace",
      description: "Workspace created for onboarding",
      is_active: true,
      default_catalog: "ANALYTICS",
      default_schema: "PUBLIC",
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/admin/workspaces",
      {
        workspace_id: "ws-222",
        organization_id: "org-44",
        name: "Acme Workspace",
        description: "Workspace created for onboarding",
        is_active: true,
        default_catalog: "ANALYTICS",
        default_schema: "PUBLIC",
      },
      {
        headers: {
          Authorization: "Bearer token-xyz",
          "X-Workspace-Id": "ws-101",
        },
      }
    );

    expect(result.workspace_id).toBe("ws-222");
    expect(result.organization_id).toBe("org-44");
  });

  it("binds workspace datasource using binding endpoint", async () => {
    mocks.patch.mockResolvedValue({
      data: {
        workspace_id: "ws-333",
        workspace_name: "Acme Workspace 2",
        organization_id: "org-44",
        datasource_id: "ds-55",
        datasource_name: "Acme Snowflake",
        datasource_type: "snowflake",
        workspace_is_active: true,
      },
    });

    const result = await bindWorkspace("ws-333", { datasource_id: "ds-55" });

    expect(mocks.patch).toHaveBeenCalledWith(
      "/admin/workspaces/ws-333/binding",
      {
        datasource_id: "ds-55",
      },
      {
        headers: {
          Authorization: "Bearer token-xyz",
          "X-Workspace-Id": "ws-101",
        },
      }
    );

    expect(result.datasource_id).toBe("ds-55");
  });

  it("posts tenancy bootstrap payload", async () => {
    mocks.post.mockResolvedValue({
      data: {
        result: {
          workspace_id: "ws-88",
          organization: { id: "org-11" },
          datasource: { id: 401 },
          workspace_binding: { workspace_id: "ws-88" },
          memberships: {},
        },
      },
    });

    const result = await bootstrapTenancy({
      workspace_id: "ws-88",
      organization_name: "Acme District",
      datasource_name: "Acme Snowflake",
      datasource_type: "snowflake",
      datasource_secret_ref: "env:ACME_SNOWFLAKE_PASSWORD",
      datasource_config_json: { account: "xy12345", warehouse: "COMPUTE_WH" },
      default_catalog: "ANALYTICS",
      default_schema: "PUBLIC",
      admin_user_id: "u-1",
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/admin/tenancy/bootstrap",
      expect.objectContaining({
        workspace_id: "ws-88",
        organization_name: "Acme District",
        datasource_name: "Acme Snowflake",
        datasource_type: "snowflake",
        datasource_secret_ref: "env:ACME_SNOWFLAKE_PASSWORD",
      }),
      {
        headers: {
          Authorization: "Bearer token-xyz",
          "X-Workspace-Id": "ws-101",
        },
      }
    );

    expect(result.workspace_id).toBe("ws-88");
    expect(result.organization.id).toBe("org-11");
  });
});
