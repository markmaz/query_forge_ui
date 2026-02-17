import { describe, expect, it } from "vitest";

import settingsReducer, {
  fetchUserWorkspaceDetail,
  setSelectedWorkspace,
} from ".././settingsSlice";

describe("settingsSlice workspace validation", () => {
  it("rejects unknown workspace IDs", () => {
    const loadedState = settingsReducer(
      undefined,
      fetchUserWorkspaceDetail.fulfilled(
        {
          workspaces: [
            { workspace_id: "ws-1", name: "Workspace 1", server: "https://ws1.example", is_default: 1 },
          ],
          persistedWorkspaceId: null,
          persistedWorkspaceValid: null,
        },
        "req-1",
        undefined
      )
    );

    const next = settingsReducer(loadedState, setSelectedWorkspace("ws-not-allowed"));

    expect(next.selectedWorkspaceId).toBe("ws-1");
    expect(next.error).toBe("Invalid workspace selection");
  });

  it("clears selection and requires reselection when persisted workspace is no longer allowed", () => {
    const state = settingsReducer(
      undefined,
      fetchUserWorkspaceDetail.fulfilled(
        {
          workspaces: [
            { workspace_id: "ws-1", name: "Workspace 1", server: "https://ws1.example", is_default: 1 },
            { workspace_id: "ws-2", name: "Workspace 2", server: "https://ws2.example", is_default: 0 },
          ],
          persistedWorkspaceId: "ws-deleted",
          persistedWorkspaceValid: false,
        },
        "req-2",
        undefined
      )
    );

    expect(state.selectedWorkspaceId).toBeNull();
    expect(state.needsWorkspaceSelection).toBe(true);
    expect(state.defaultWorkspace?.workspace_id).toBe("ws-1");
  });
});
