import { afterEach, describe, expect, it } from "vitest";

import { getApiWorkspaceId, setApiWorkspaceId } from "../api";

describe("api workspace key compatibility", () => {
  afterEach(() => {
    setApiWorkspaceId(null);
  });

  it("persists both workspaceId and workspace_id keys", () => {
    setApiWorkspaceId("ws-compat");

    expect(getApiWorkspaceId()).toBe("ws-compat");
    expect(window.localStorage.getItem("workspaceId")).toBe("ws-compat");
    expect(window.localStorage.getItem("workspace_id")).toBe("ws-compat");
  });

  it("clears both storage keys when workspace is unset", () => {
    setApiWorkspaceId("ws-compat");
    setApiWorkspaceId(null);

    expect(getApiWorkspaceId()).toBeNull();
    expect(window.localStorage.getItem("workspaceId")).toBeNull();
    expect(window.localStorage.getItem("workspace_id")).toBeNull();
  });
});
