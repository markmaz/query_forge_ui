import { afterEach, describe, expect, it } from "vitest";

import api, { WorkspaceAccessDeniedError, setApiWorkspaceId } from ".././api";
import {
  WORKSPACE_ACCESS_DENIED_EVENT,
  isWorkspaceAccessDeniedResponse,
  type WorkspaceAccessDeniedDetail,
} from "../../runtime/workspaceAccess";

describe("workspace 403 handling", () => {
  afterEach(() => {
    setApiWorkspaceId(null);
    window.history.pushState({}, "", "/");
  });

  it("detects workspace access denied responses", () => {
    expect(
      isWorkspaceAccessDeniedResponse(403, { error: "You do not have access to this workspace" })
    ).toBe(true);
    expect(
      isWorkspaceAccessDeniedResponse(403, { message: "you do NOT have ACCESS to this workspace" })
    ).toBe(true);
    expect(isWorkspaceAccessDeniedResponse(403, { error: "forbidden" })).toBe(false);
    expect(
      isWorkspaceAccessDeniedResponse(401, { error: "You do not have access to this workspace" })
    ).toBe(false);
  });

  it("maps workspace 403 to a typed error and emits reset event", async () => {
    window.history.pushState({}, "", "/settings");
    setApiWorkspaceId("ws-1");
    const events: WorkspaceAccessDeniedDetail[] = [];

    const onDenied = (event: Event) => {
      events.push((event as CustomEvent<WorkspaceAccessDeniedDetail>).detail);
    };
    window.addEventListener(WORKSPACE_ACCESS_DENIED_EVENT, onDenied as EventListener);

    const adapter = async () =>
      Promise.reject({
        config: { url: "/domains", headers: { "X-Workspace-Id": "ws-1" } },
        response: {
          status: 403,
          data: { error: "You do not have access to this workspace" },
        },
      });

    let caught: unknown = null;
    try {
      await api.get("/domains", { adapter });
    } catch (err) {
      caught = err;
    } finally {
      window.removeEventListener(WORKSPACE_ACCESS_DENIED_EVENT, onDenied as EventListener);
    }

    expect(caught).toBeInstanceOf(WorkspaceAccessDeniedError);
    expect(events).toHaveLength(1);
    expect(events[0]?.requested_workspace_id).toBe("ws-1");
    expect(events[0]?.route).toBe("/settings");
  });
});
