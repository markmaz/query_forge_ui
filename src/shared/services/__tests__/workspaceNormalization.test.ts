import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listUserWorkspaces: vi.fn(),
  listWorkspaces: vi.fn(),
  listWorkspaceUsers: vi.fn(),
  setDefaultWorkspace: vi.fn(),
  getWorkspaceExternalLinks: vi.fn(),
}));

vi.mock("../clients/workspaceClient", () => ({
  workspaceClient: {
    listUserWorkspaces: mocks.listUserWorkspaces,
    listWorkspaces: mocks.listWorkspaces,
    listWorkspaceUsers: mocks.listWorkspaceUsers,
    setDefaultWorkspace: mocks.setDefaultWorkspace,
    getWorkspaceExternalLinks: mocks.getWorkspaceExternalLinks,
  },
}));

import { fetchWorkspaces, getUserWorkspaceDetails } from "../workspace";

describe("workspace service normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes workspaceId payloads returned in paged shapes", async () => {
    mocks.listWorkspaces.mockResolvedValueOnce({
      data: {
        rows: [{ workspaceId: "ws-1", workspaceName: "Primary", host: "warehouse-1" }],
      },
    });
    mocks.listUserWorkspaces.mockResolvedValueOnce({
      data: [{ workspaceId: "ws-1", isDefault: true }],
    });

    const details = await getUserWorkspaceDetails("user-1");

    expect(details).toEqual([
      {
        workspace_id: "ws-1",
        name: "Primary",
        server: "warehouse-1",
        is_default: 1,
      },
    ]);
  });

  it("returns fallback user workspace rows when detail lookup is missing", async () => {
    mocks.listWorkspaces.mockResolvedValueOnce({ data: { rows: [] } });
    mocks.listUserWorkspaces.mockResolvedValueOnce({
      data: [{ workspace_id: "ws-2", is_default: 1 }],
    });

    const details = await getUserWorkspaceDetails("user-2");

    expect(details).toEqual([
      {
        workspace_id: "ws-2",
        name: "ws-2",
        server: "-",
        is_default: 1,
      },
    ]);
  });

  it("normalizes listWorkspaces array and paged response variants", async () => {
    mocks.listWorkspaces.mockResolvedValueOnce({
      data: {
        rows: [
          { workspaceId: "ws-11", name: "One", server: "server-1" },
          { workspace_id: "ws-12", name: "Two", server: "server-2" },
        ],
      },
    });

    const rows = await fetchWorkspaces();

    expect(rows).toEqual([
      { workspace_id: "ws-11", name: "One", server: "server-1" },
      { workspace_id: "ws-12", name: "Two", server: "server-2" },
    ]);
  });
});
