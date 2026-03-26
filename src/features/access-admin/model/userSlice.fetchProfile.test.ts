import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Buffer } from "buffer";

import reducer, { fetchUserProfile } from "./userSlice";
import { clearAccessToken, setAccessToken } from "../../../shared/runtime/accessTokenStore";

const mocks = vi.hoisted(() => ({
  fetchUserInfo: vi.fn(),
  fetchUserRoles: vi.fn(),
}));

vi.mock("../../../shared/services/users", () => ({
  fetchUserInfo: mocks.fetchUserInfo,
  fetchUserRoles: mocks.fetchUserRoles,
}));

const createToken = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
};

describe("fetchUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccessToken();
  });

  it("merges effective roles from the roles endpoint into the user profile", async () => {
    setAccessToken(createToken({ sub: "wa-1", roles: [], is_admin: false }));
    mocks.fetchUserInfo.mockResolvedValue({
      user_id: "wa-1",
      user_name: "workspace.admin",
      workspaces: [],
    });
    mocks.fetchUserRoles.mockResolvedValue({
      user_id: "wa-1",
      direct_roles: [{ role_id: "1", role_name: "workspace_admin" }],
      effective_roles: [{ role_id: "1", role_name: "workspace_admin" }],
    });

    const store = configureStore({
      reducer: {
        user: reducer,
      },
    });

    await store.dispatch(fetchUserProfile());
    const state = store.getState().user;

    expect(mocks.fetchUserRoles).toHaveBeenCalledWith("wa-1");
    expect(state.user.effective_roles).toEqual([{ role_id: "1", role_name: "workspace_admin" }]);
    expect(state.rolesByFeature.workspaces).toContain("admin");
    expect(state.capabilities).toContain("system:admin");
  });
});
