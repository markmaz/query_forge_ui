import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "react-toastify";

import {
  attachWorkspaceAccessDeniedListener,
  attachWorkspaceHeaderSync,
  createAppStore,
} from ".././store";
import {
  fetchUserWorkspaceDetail,
  setSelectedWorkspace,
} from "../../../features/preferences/model/settingsSlice";
import { queryClient } from "../../../shared/runtime/queryClient";
import {
  WORKSPACE_ACCESS_DENIED_EVENT,
  WORKSPACE_TELEMETRY_EVENT,
} from "../../../shared/runtime/workspaceAccess";
import { getApiWorkspaceId } from "../../../shared/services/api";

describe("workspace 403 recovery flow", () => {
  beforeEach(() => {
    queryClient.clear();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/query-studio/v2");
    vi.spyOn(toast, "error").mockImplementation(() => "" as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears workspace state/caches on denial and restores behavior after valid reselection", () => {
    const appStore = createAppStore({
      user: {
        user: { user_id: "user-123" },
        rolesByFeature: {},
        capabilities: [],
        loading: false,
        initialized: true,
        error: null,
      } as any,
    });
    const detachHeaderSync = attachWorkspaceHeaderSync(appStore);
    const detachDeniedListener = attachWorkspaceAccessDeniedListener(appStore);

    appStore.dispatch(
      fetchUserWorkspaceDetail.fulfilled(
        {
          workspaces: [
            { workspace_id: "ws-1", name: "Workspace 1", server: "https://ws1.example", is_default: 1 },
            { workspace_id: "ws-2", name: "Workspace 2", server: "https://ws2.example", is_default: 0 },
          ],
          persistedWorkspaceId: null,
          persistedWorkspaceValid: null,
        },
        "req-1",
        undefined
      )
    );
    appStore.dispatch(setSelectedWorkspace("ws-1"));

    queryClient.setQueryData(["workspaceScoped", "domains"], [{ id: 1 }]);
    window.localStorage.setItem("query_builder_preview:test", JSON.stringify({ rows: [1] }));

    const telemetryEvents: Array<Record<string, unknown>> = [];
    const telemetryListener = (event: Event) => {
      telemetryEvents.push((event as CustomEvent<Record<string, unknown>>).detail);
    };
    window.addEventListener(WORKSPACE_TELEMETRY_EVENT, telemetryListener as EventListener);

    window.dispatchEvent(
      new CustomEvent(WORKSPACE_ACCESS_DENIED_EVENT, {
        detail: {
          route: "/query-studio/v2",
          requested_workspace_id: "ws-1",
          timestamp: "2026-02-12T20:00:00.000Z",
        },
      })
    );

    expect(appStore.getState().userWorkspaces.selectedWorkspaceId).toBeNull();
    expect(appStore.getState().userWorkspaces.needsWorkspaceSelection).toBe(true);
    expect(getApiWorkspaceId()).toBeNull();
    expect(window.localStorage.getItem("workspaceId")).toBeNull();
    expect(window.localStorage.getItem("query_builder_preview:test")).toBeNull();
    expect(queryClient.getQueryData(["workspaceScoped", "domains"])).toBeUndefined();
    expect(telemetryEvents.length).toBeGreaterThan(0);
    const matched = telemetryEvents.find(
      (event) =>
        event.route === "/query-studio/v2" &&
        event.requested_workspace_id === "ws-1" &&
        event.user_id === "user-123"
    );
    expect(matched).toBeDefined();
    expect(matched?.timestamp).toBe("2026-02-12T20:00:00.000Z");

    appStore.dispatch(setSelectedWorkspace("ws-2"));

    expect(appStore.getState().userWorkspaces.selectedWorkspaceId).toBe("ws-2");
    expect(appStore.getState().userWorkspaces.needsWorkspaceSelection).toBe(false);
    expect(getApiWorkspaceId()).toBe("ws-2");
    expect(window.localStorage.getItem("workspaceId")).toBe("ws-2");

    window.removeEventListener(WORKSPACE_TELEMETRY_EVENT, telemetryListener as EventListener);
    detachDeniedListener();
    detachHeaderSync();
  });
});
