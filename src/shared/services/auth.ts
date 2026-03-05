import api from "./api";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginEmailOtpResponse = {
  requires_otp: true;
  challenge_id: string;
  challenge_expires_in: number;
};

export type LoginTotpChallengeResponse = {
  mfa_required: true;
  mfa_type: "totp";
  challenge_id: string;
  challenge_expires_in: number;
};

export type LoginDirectSuccessResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type LoginResponse =
  | LoginEmailOtpResponse
  | LoginTotpChallengeResponse
  | LoginDirectSuccessResponse;

export type VerifyOtpPayload = {
  challenge_id: string;
  otp: string;
};

export type VerifyOtpResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type VerifyTotpChallengePayload = {
  challenge_id: string;
  code: string;
};

export type TotpStartResponse = {
  qr_svg: string;
  manual_secret_masked: string;
  [key: string]: unknown;
};

export type TotpConfirmPayload = {
  code: string;
};

export type TotpDisablePayload = {
  password: string;
  code: string;
};

type AuthTokenClaims = {
  roles?: unknown;
  is_admin?: unknown;
};

export type AuthApiErrorCode =
  | "invalid_username_or_password"
  | "too_many_attempts"
  | "code_required"
  | "invalid_or_expired_challenge"
  | "invalid_mfa_code"
  | "retry_later"
  | "unknown";

export class AuthApiError extends Error {
  status?: number;
  code: AuthApiErrorCode;

  constructor(code: AuthApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
  }
}

type ErrorWithStatus = Error & { status?: number };

const withStatus = (message: string, status?: number): ErrorWithStatus => {
  const err = new Error(message) as ErrorWithStatus;
  err.status = status;
  return err;
};

const mapLoginError = (status?: number) => {
  if (status === 401) {
    return new AuthApiError("invalid_username_or_password", "Invalid username or password.", status);
  }
  if (status === 429) {
    return new AuthApiError("too_many_attempts", "Too many attempts. Please wait and try again.", status);
  }
  return new AuthApiError("unknown", "Unable to sign in. Please try again.", status);
};

const mapVerifyError = (status?: number) => {
  if (status === 400) {
    return new AuthApiError("code_required", "Code is required.", status);
  }
  if (status === 401) {
    return new AuthApiError("invalid_or_expired_challenge", "Invalid code or expired challenge.", status);
  }
  if (status === 429) {
    return new AuthApiError("too_many_attempts", "Too many attempts. Please wait and try again.", status);
  }
  return new AuthApiError("unknown", "Unable to verify code. Please try again.", status);
};

const mapTotpVerifyError = (status?: number) => {
  if (status === 400) {
    return new AuthApiError("code_required", "Code is required.", status);
  }
  if (status === 401) {
    return new AuthApiError("invalid_mfa_code", "Invalid authenticator code.", status);
  }
  if (status === 429) {
    return new AuthApiError("retry_later", "Too many attempts. Please try again later.", status);
  }
  return new AuthApiError("unknown", "Unable to verify authenticator code. Please try again.", status);
};

function asApiMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data as
    | { message?: string; error?: string; detail?: string }
    | undefined;
  return data?.message ?? data?.error ?? data?.detail ?? fallback;
}

const hasChallengeEnvelope = (
  value: unknown
): value is Pick<LoginEmailOtpResponse, "challenge_id" | "challenge_expires_in"> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { challenge_id?: unknown }).challenge_id === "string" &&
  typeof (value as { challenge_expires_in?: unknown }).challenge_expires_in === "number";

export function getRolesFromToken(token?: string | null): string[] {
  if (!token) return [];
  try {
    const decoded = jwtDecode<AuthTokenClaims>(token);
    if (!Array.isArray(decoded.roles)) return [];
    return decoded.roles
      .map((role) => String(role ?? "").trim())
      .filter((role) => role.length > 0);
  } catch {
    return [];
  }
}

export function isAdmin(token?: string | null): boolean {
  if (!token) return false;
  try {
    const decoded = jwtDecode<AuthTokenClaims>(token);
    if (decoded.is_admin === true) return true;
  } catch {
    return false;
  }

  return getRolesFromToken(token).some((role) => role.toLowerCase() === "admin");
}

export async function login(credentials: LoginPayload): Promise<LoginResponse> {
  try {
    const res = await api.post<LoginResponse>("/auth/login", credentials, {
      headers: { "Content-Type": "application/json" },
    });
    const payload = res.data as unknown;
    if (!payload || typeof payload !== "object") {
      throw new AuthApiError("unknown", "Unable to sign in. Please try again.");
    }

    const record = payload as Record<string, unknown>;

    if (typeof record.access_token === "string" && record.access_token.trim().length) {
      return {
        access_token: record.access_token,
        ...(typeof record.token_type === "string" ? { token_type: record.token_type } : {}),
        ...(typeof record.expires_in === "number" ? { expires_in: record.expires_in } : {}),
      };
    }
    if (record.requires_otp === true && hasChallengeEnvelope(record)) {
      return {
        requires_otp: true,
        challenge_id: record.challenge_id,
        challenge_expires_in: record.challenge_expires_in,
      };
    }
    if (record.mfa_required === true && record.mfa_type === "totp" && hasChallengeEnvelope(record)) {
      return {
        mfa_required: true,
        mfa_type: "totp",
        challenge_id: record.challenge_id,
        challenge_expires_in: record.challenge_expires_in,
      };
    }
    if (hasChallengeEnvelope(record)) {
      // Backward-compatible fallback for challenge-shaped responses.
      return {
        requires_otp: true,
        challenge_id: record.challenge_id,
        challenge_expires_in: record.challenge_expires_in,
      };
    }
    throw new AuthApiError("unknown", "Unable to sign in. Please try again.");
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      throw mapLoginError(e.response?.status);
    }
    if (e instanceof AuthApiError) throw e;
    throw e;
  }
}

export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  try {
    const res = await api.post<VerifyOtpResponse>("/otp/verify", payload, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    });
    return res.data;
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      throw mapVerifyError(e.response?.status);
    }
    if (e instanceof AuthApiError) throw e;
    throw e;
  }
}

export async function verifyTotpChallenge(payload: VerifyTotpChallengePayload): Promise<VerifyOtpResponse> {
  try {
    const res = await api.post<VerifyOtpResponse>("/auth/mfa/totp/verify", payload, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    });
    return res.data;
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      throw mapTotpVerifyError(e.response?.status);
    }
    if (e instanceof AuthApiError) throw e;
    throw e;
  }
}

export async function startTotpEnrollment(): Promise<TotpStartResponse> {
  try {
    const res = await api.post<TotpStartResponse>("/auth/mfa/totp/start", {});
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw withStatus(asApiMessage(error, "Unable to start authenticator setup."), error.response?.status);
    }
    throw error;
  }
}

export async function confirmTotpEnrollment(payload: TotpConfirmPayload): Promise<void> {
  try {
    await api.post("/auth/mfa/totp/confirm", payload, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw withStatus(asApiMessage(error, "Unable to confirm authenticator setup."), error.response?.status);
    }
    throw error;
  }
}

export async function disableTotp(payload: TotpDisablePayload): Promise<void> {
  try {
    await api.post("/auth/mfa/totp/disable", payload, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw withStatus(asApiMessage(error, "Unable to disable authenticator app."), error.response?.status);
    }
    throw error;
  }
}

export async function logout(accessToken?: string | null): Promise<void> {
  await api.post(
    "/auth/logout",
    {},
    accessToken
      ? {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      : undefined
  );
}

export const resetPasswordRequest = async(email: string) => {
    try {
        const data = {email};
        const response = await api.post(`/auth/reset/request`, data);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const data = error.response?.data as { error?: string; message?: string } | undefined;
            const message = data?.error ?? data?.message ?? error.message ?? "Unable to submit reset request.";
            throw withStatus(message, error.response?.status);
        }
        throw error;
    }
}

export const validateResetToken = async(token: string) => {
    try{
        const data = {token};
        const response = await api.post(`/auth/reset/validate`, data);
        return response.data;
    } catch(error){
        if (axios.isAxiosError(error)) {
            const data = error.response?.data as { error?: string; message?: string } | undefined;
            const message = data?.error ?? data?.message ?? error.message ?? "Unable to validate reset token.";
            throw withStatus(message, error.response?.status);
        }
        throw error;
    }
}

export const resetPassword = async(password: string) => {
    try{
        const data = {password};
        const response = await api.post(`/auth/reset/password`, data);
        
        if(response.status < 200 || response.status >= 300){
            throw Error("Password was not reset");
        }
    } catch(error){
        if (axios.isAxiosError(error)) {
            const data = error.response?.data as { error?: string; message?: string } | undefined;
            const message = data?.error ?? data?.message ?? error.message ?? "Password was not updated.";
            throw withStatus(message, error.response?.status);
        }
        if (error instanceof Error) {
            throw error;
        }
        throw Error("Password was not updated.");
    }
}
