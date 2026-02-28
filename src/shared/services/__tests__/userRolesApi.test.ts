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
          role_id: "admin",
          role_name: "Admin",
          created: true,
        },
      },
    });

    const result = await addUserRole("u-1", { role_id: "admin" });
    expect(mocks.post).toHaveBeenCalledWith("/users/u-1/roles", { role_id: "admin" });
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

    const result = await replaceUserRoles("u-1", { role_ids: ["admin", "viewer"] });
    expect(mocks.put).toHaveBeenCalledWith("/users/u-1/roles", { role_ids: ["admin", "viewer"] });
    expect(result.count).toBe(2);
  });

  it("patches one direct role mapping", async () => {
    mocks.patch.mockResolvedValue({
      data: {
        user_id: "u-1",
        old_role_id: "admin",
        new_role_id: "viewer",
        created: true,
      },
    });

    const result = await patchUserRole("u-1", "admin", { role_id: "viewer" });
    expect(mocks.patch).toHaveBeenCalledWith("/users/u-1/roles/admin", { role_id: "viewer" });
    expect(result.new_role_id).toBe("viewer");
  });

  it("removes one direct role mapping", async () => {
    mocks.delete.mockResolvedValue({
      data: { user_id: "u-1", role_id: "viewer", deleted: true },
    });

    const result = await removeUserRole("u-1", "viewer");
    expect(mocks.delete).toHaveBeenCalledWith("/users/u-1/roles/viewer");
    expect(result.deleted).toBe(true);
  });

  it("passes rbac_role_ids on full user update when provided", async () => {
    mocks.put.mockResolvedValue({
      data: {
        user_id: "u-1",
        email: "user@example.com",
        products: [],
        workspaces: [],
      },
    });

    await updateUserInfo({
      user_id: "u-1",
      email: "user@example.com",
      products: [],
      workspaces: [],
      rbac_role_ids: ["admin", "viewer"],
    });

    expect(mocks.put).toHaveBeenCalledWith("/users/u-1", {
      user_id: "u-1",
      email: "user@example.com",
      products: [],
      workspaces: [],
      rbac_role_ids: ["admin", "viewer"],
    });
  });
});

