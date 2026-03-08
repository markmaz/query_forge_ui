import api from "../api";

const JSON_HEADERS = { "Content-Type": "application/json" };
const NO_STORE_HEADERS = {
  ...JSON_HEADERS,
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

export const identityClient = {
  login(payload: unknown) {
    return api.post("/auth/login", payload, { headers: JSON_HEADERS });
  },
  verifyOtp(payload: unknown) {
    return api.post("/otp/verify", payload, { headers: NO_STORE_HEADERS });
  },
  verifyTotpChallenge(payload: unknown) {
    return api.post("/auth/mfa/totp/verify", payload, { headers: NO_STORE_HEADERS });
  },
  startTotpEnrollment() {
    return api.post("/auth/mfa/totp/start", {});
  },
  confirmTotpEnrollment(payload: unknown) {
    return api.post("/auth/mfa/totp/confirm", payload, { headers: JSON_HEADERS });
  },
  disableTotp(payload: unknown) {
    return api.post("/auth/mfa/totp/disable", payload, { headers: JSON_HEADERS });
  },
  logout(accessToken?: string | null) {
    return api.post(
      "/auth/logout",
      {},
      accessToken
        ? {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        : undefined
    );
  },
  requestPasswordReset(email: string) {
    return api.post("/auth/reset/request", { email });
  },
  validateResetToken(token: string) {
    return api.post("/auth/reset/validate", { token });
  },
  resetPassword(password: string) {
    return api.post("/auth/reset/password", { password });
  },
};

