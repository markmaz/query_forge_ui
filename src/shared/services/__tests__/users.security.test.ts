import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchUserInfo, fetchUsers, updateUserInfo } from ".././users";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock(".././api", () => ({
  default: {
    get: mocks.get,
    put: mocks.put,
    post: mocks.post,
    delete: mocks.delete,
  },
}));

describe("users API hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses user list responses when password/otp_secret are absent", async () => {
    mocks.get.mockResolvedValue({
      data: {
        users: [
          {
            user_id: "u1",
            email: "user@example.com",
            status: "Active",
            last_log_in: null,
            first_name: "User",
            last_name: "One",
          },
        ],
        next_cursor: null,
        prev_cursor: null,
      },
    });

    const result = await fetchUsers("Active", 10, "", "", "");

    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toEqual({
      user_id: "u1",
      email: "user@example.com",
      status: "Active",
      last_log_in: null,
      first_name: "User",
      last_name: "One",
    });
    expect(result.users[0]).not.toHaveProperty("password");
    expect(result.users[0]).not.toHaveProperty("otp_secret");
  });

  it("handles update success without password/otp_secret in response", async () => {
    mocks.put.mockResolvedValue({
      data: {
        user_id: "u1",
        email: "user@example.com",
        first_name: "Updated",
        last_name: "User",
        status: "Active",
        workspaces: [],
      },
    });

    const result = await updateUserInfo({
      user_id: "u1",
      email: "user@example.com",
      workspaces: [],
    });

    expect(result.user_id).toBe("u1");
    expect(result.email).toBe("user@example.com");
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("otp_secret");
  });

  it("sends only editable profile fields for user updates", async () => {
    mocks.put.mockResolvedValue({
      data: {
        user_id: "u1",
        email: "user@example.com",
        status: "Active",
        workspaces: [],
      },
    });

    await updateUserInfo({
      user_id: "u1",
      email: "user@example.com",
      workspaces: [],
      password: "should-not-be-sent",
      otp_secret: "should-not-be-sent",
    } as any);

    expect(mocks.put).toHaveBeenCalledWith("/users/u1", {
      user_id: "u1",
      email: "user@example.com",
      workspaces: [],
    });
  });

  it("does not log sensitive password/otp_secret keys from user API errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    mocks.get.mockRejectedValue({
      response: {
        data: {
          password: "super-secret",
          otp_secret: "123456",
        },
      },
    });

    await fetchUserInfo("u1");

    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    const combinedLogs = errorSpy.mock.calls.flat().map((value) => String(value)).join(" ");
    expect(combinedLogs).not.toMatch(/password/i);
    expect(combinedLogs).not.toMatch(/otp_secret/i);

    errorSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
