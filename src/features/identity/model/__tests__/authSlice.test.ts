import { describe, expect, it } from "vitest";
import reducer, {
  expireOtpChallenge,
  fetchAuthToken,
  resetAuthFlow,
  verifyOtpAndStoreToken,
} from ".././authSlice";

const baseState = reducer(undefined, { type: "@@INIT" });

describe("authSlice state machine", () => {
  it("transitions from credentials to otp_required after credential success", () => {
    const next = reducer(
      baseState,
      fetchAuthToken.fulfilled(
        {
          step: "challenge",
          challengeId: "challenge-1",
          challengeExpiresAt: Date.now() + 120_000,
          mfaType: "email_otp",
        },
        "req-1",
        { username: "user@example.com", password: "password" },
      ),
    );

    expect(next.authStep).toBe("otp_required");
    expect(next.mfaType).toBe("email_otp");
    expect(next.challengeId).toBe("challenge-1");
    expect(next.isAuthenticated).toBe(false);
  });

  it("stores totp challenge type when login requires authenticator app", () => {
    const next = reducer(
      baseState,
      fetchAuthToken.fulfilled(
        {
          step: "challenge",
          challengeId: "challenge-2",
          challengeExpiresAt: Date.now() + 120_000,
          mfaType: "totp",
        },
        "req-1b",
        { username: "user@example.com", password: "password" },
      ),
    );

    expect(next.authStep).toBe("otp_required");
    expect(next.mfaType).toBe("totp");
    expect(next.challengeId).toBe("challenge-2");
  });

  it("transitions from otp_required to authenticated after OTP verify success", () => {
    const otpState = {
      ...baseState,
      authStep: "otp_required" as const,
      challengeId: "challenge-1",
      challengeExpiresAt: Date.now() + 120_000,
    };

    const next = reducer(
      otpState,
      verifyOtpAndStoreToken.fulfilled("access-token", "req-2", {
        otp: "123456",
      }),
    );

    expect(next.authStep).toBe("authenticated");
    expect(next.isAuthenticated).toBe(true);
    expect(next.challengeId).toBeNull();
  });

  it("returns to credentials after invalid or expired challenge", () => {
    const otpState = {
      ...baseState,
      authStep: "otp_required" as const,
      challengeId: "challenge-1",
      challengeExpiresAt: Date.now() + 120_000,
    };

    const rejectedAction = verifyOtpAndStoreToken.rejected(
      new Error("Invalid code or expired challenge."),
      "req-3",
      { otp: "123456" },
      {
        code: "invalid_or_expired_challenge",
        message: "Invalid code or expired challenge.",
        resetFlow: true,
      },
    );

    const next = reducer(otpState, rejectedAction);
    expect(next.authStep).toBe("credentials");
    expect(next.challengeId).toBeNull();
    expect(next.isAuthenticated).toBe(false);
  });

  it("supports explicit reset and expiry transitions", () => {
    const otpState = {
      ...baseState,
      authStep: "otp_required" as const,
      challengeId: "challenge-1",
      challengeExpiresAt: Date.now() + 120_000,
    };

    const expired = reducer(otpState, expireOtpChallenge());
    expect(expired.authStep).toBe("credentials");
    expect(expired.challengeId).toBeNull();

    const reset = reducer(otpState, resetAuthFlow());
    expect(reset.authStep).toBe("credentials");
    expect(reset.challengeId).toBeNull();
    expect(reset.isAuthenticated).toBe(false);
  });
});
