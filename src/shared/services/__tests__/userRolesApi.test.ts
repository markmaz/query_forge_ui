import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addUserRole,
  fetchUserRoles,
  patchUserRole,
  removeUserRole,
  replaceUserRoles,
  updateUserInfo,
} from ".././users";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock(".././api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}));

describe("user roles API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches direct/effective roles", async () => {
    mocks.get.mockResolvedValue({
      data: {
        user_id: "u-1",
        direct_roles: [{ role_id: "admin", role_name: "Admin" }],
        effective_roles: [{ role_id: "viewer", role_name: "Viewer" }],
      },
    });

    const result = await fetchUserRoles("u-1");

    expect(mocks.get).toHaveBeenCalledWith("/users/u-1/roles");
    expect(result.direct_roles).toHaveLength(1);
    expect(result.effective_roles).toHaveLength(1);
  });

  it("adds one direct role", async () => {
    mocks.post.mockResolvedValue({
      data: {
        mapping: {
          user_id: "u-1",
          role_name: "skills:admin",
          created: true,
        },
      },
    });

    const result = await addUserRole("u-1", { role_name: "skills:admin" });
    expect(mocks.post).toHaveBeenCalledWith("/users/u-1/roles", { role_name: "skills:admin" });
    expect(result.mapping.created).toBe(true);
  });

  it("replaces all direct roles", async () => {
    mocks.put.mockResolvedValue({
      data: {
        user_id: "u-1",
        roles: [
          { role_id: "admin", role_name: "Admin" },
          { role_id: "viewer", role_name: "Viewer" },
        ],
        count: 2,
      },
    });

    const result = await replaceUserRoles("u-1", { role_names: ["skills:admin", "skills:user"] });
    expect(mocks.put).toHaveBeenCalledWith("/users/u-1/roles", { role_names: ["skills:admin", "skills:user"] });
    expect(result.count).toBe(2);
  });

  it("patches one direct role mapping", async () => {
    mocks.patch.mockResolvedValue({
      data: {
        user_id: "u-1",
        old_role_name: "skills:admin",
        new_role_name: "skills:user",
        created: true,
      },
    });

    const result = await patchUserRole("u-1", "skills:admin", { role_name: "skills:user" });
    expect(mocks.patch).toHaveBeenCalledWith("/users/u-1/roles/skills%3Aadmin", { role_name: "skills:user" });
    expect(result.new_role_name).toBe("skills:user");
  });

  it("removes one direct role mapping", async () => {
    mocks.delete.mockResolvedValue({
      data: { user_id: "u-1", role_name: "skills:user", deleted: true },
    });

    const result = await removeUserRole("u-1", "skills:user");
    expect(mocks.delete).toHaveBeenCalledWith("/users/u-1/roles/skills%3Auser");
    expect(result.deleted).toBe(true);
  });

  it("passes rbac_role_names on full user update when provided", async () => {
    mocks.put.mockResolvedValue({
      data: {
        user_id: "u-1",
        email: "user@example.com",
        workspaces: [],
      },
    });

    await updateUserInfo({
      user_id: "u-1",
      email: "user@example.com",
      workspaces: [],
      rbac_role_names: ["skills:admin", "skills:user"],
    });

    expect(mocks.put).toHaveBeenCalledWith("/users/u-1", {
      user_id: "u-1",
      email: "user@example.com",
      workspaces: [],
      rbac_role_names: ["skills:admin", "skills:user"],
    });
  });
});
