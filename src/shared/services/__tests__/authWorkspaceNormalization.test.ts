import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  verifyOtp: vi.fn(),
  verifyTotpChallenge: vi.fn(),
  startTotpEnrollment: vi.fn(),
  confirmTotpEnrollment: vi.fn(),
  disableTotp: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  validateResetToken: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("../clients/identityClient", () => ({
  identityClient: {
    login: mocks.login,
    verifyOtp: mocks.verifyOtp,
    verifyTotpChallenge: mocks.verifyTotpChallenge,
    startTotpEnrollment: mocks.startTotpEnrollment,
    confirmTotpEnrollment: mocks.confirmTotpEnrollment,
    disableTotp: mocks.disableTotp,
    logout: mocks.logout,
    requestPasswordReset: mocks.requestPasswordReset,
    validateResetToken: mocks.validateResetToken,
    resetPassword: mocks.resetPassword,
  },
}));

import { login, verifyOtp, verifyTotpChallenge } from "../auth";

describe("auth workspace key normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes workspaceId to workspace_id on login success", async () => {
    mocks.login.mockResolvedValueOnce({
      data: {
        access_token: "token-1",
        token_type: "bearer",
        expires_in: 3600,
        workspaceId: "ws-123",
      },
    });

    const response = await login({ username: "user", password: "pw" });

    expect(response).toMatchObject({
      access_token: "token-1",
      workspace_id: "ws-123",
    });
  });

  it("preserves workspace_id from otp and totp verification responses", async () => {
    mocks.verifyOtp.mockResolvedValueOnce({
      data: {
        access_token: "token-otp",
        workspace_id: "ws-otp",
      },
    });
    mocks.verifyTotpChallenge.mockResolvedValueOnce({
      data: {
        access_token: "token-totp",
        workspaceId: "ws-totp",
      },
    });

    const otp = await verifyOtp({ challenge_id: "ch-1", otp: "123456" });
    const totp = await verifyTotpChallenge({ challenge_id: "ch-2", code: "654321" });

    expect(otp.workspace_id).toBe("ws-otp");
    expect(totp.workspace_id).toBe("ws-totp");
  });
});
