import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../app/providers/store";

import { AuthApiError, login, logout as apiLogout, verifyOtp } from "../../../shared/services/auth";
import { clearAccessToken, getAccessToken, setAccessToken } from "../../../shared/lib/accessTokenStore";
import { refreshAccessToken } from "../../../shared/services/api";

/** ── Types ───────────────────────────────────────────────────────────── */
interface LoginPayload {
  username: string;
  password: string;
}

export type AuthStep = "credentials" | "otp_required" | "authenticated";

export type AuthThunkErrorCode =
  | "invalid_username_or_password"
  | "too_many_attempts"
  | "code_required"
  | "invalid_or_expired_challenge"
  | "challenge_expired"
  | "unknown";

export type AuthThunkError = {
  code: AuthThunkErrorCode;
  message: string;
  resetFlow?: boolean;
};

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  authStep: AuthStep;
  challengeId: string | null;
  challengeExpiresAt: number | null;

  loading: boolean;
  bootstrapped: boolean;
  error: string | null;
}

/** ── Initial State ───────────────────────────────────────────────────── */
const initialState: AuthState = {
  token: null,
  isAuthenticated: false,
  authStep: "credentials",
  challengeId: null,
  challengeExpiresAt: null,

  loading: false,
  bootstrapped: false,
  error: null,
};

const asThunkError = (
  code: AuthThunkErrorCode,
  message: string,
  resetFlow = false
): AuthThunkError => ({ code, message, resetFlow });

const normalizeOtp = (value: string): string => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.slice(-6).padStart(6, "0");
};

/** ── Thunks ──────────────────────────────────────────────────────────── */
/** On app start: rehydrate token from storage (and optionally fetch profile) */
export const bootstrapAuth = createAsyncThunk<
  { token: string | null },
  void,
  { rejectValue: string }
>("auth/bootstrap", async (_: void, { rejectWithValue }) => {
  try {
    const token = await refreshAccessToken();
    return { token };
  } catch {
    return { token: null };
  }
});

/** Step 1: username/password – returns OTP challenge */
export const fetchAuthToken = createAsyncThunk<
  { challengeId: string; challengeExpiresAt: number },
  LoginPayload,
  { rejectValue: AuthThunkError }
>("auth/fetchAuthToken", async (credentials, { rejectWithValue }) => {
  try {
    const data = await login(credentials);
    return {
      challengeId: data.challenge_id,
      challengeExpiresAt: Date.now() + data.challenge_expires_in * 1000,
    };
  } catch (err) {
    if (err instanceof AuthApiError) {
      if (err.status === 401) {
        return rejectWithValue(
          asThunkError("invalid_username_or_password", "Invalid username or password.")
        );
      }
      return rejectWithValue(asThunkError(err.code, err.message));
    }
    return rejectWithValue(asThunkError("unknown", "Unable to sign in. Please try again."));
  }
});

/** Step 2: OTP – returns JWT; we persist and mark authenticated */
export const verifyOtpAndStoreToken = createAsyncThunk<
  string,
  { otp: string },
  { state: RootState; rejectValue: AuthThunkError }
>("auth/verifyOtpAndStoreToken", async ({ otp }, { getState, rejectWithValue }) => {
  try {
    const state = getState();
    const challengeId = state.auth.challengeId;
    const challengeExpiresAt = state.auth.challengeExpiresAt;

    if (!challengeId || !challengeExpiresAt || Date.now() >= challengeExpiresAt) {
      return rejectWithValue(
        asThunkError("challenge_expired", "Invalid code or expired challenge.", true)
      );
    }

    const rawOtp = String(otp ?? "").replace(/\D/g, "");
    if (!rawOtp) {
      return rejectWithValue(asThunkError("code_required", "Code is required."));
    }
    const normalizedOtp = normalizeOtp(rawOtp);

    const data = await verifyOtp({ challenge_id: challengeId, otp: normalizedOtp });
    const token = data?.access_token;

    if (!token) {
      return rejectWithValue(asThunkError("unknown", "Unable to verify code. Please try again."));
    }

    setAccessToken(token);
    return token;
  } catch (err) {
    if (err instanceof AuthApiError) {
      const resetFlow = err.code === "invalid_or_expired_challenge";
      return rejectWithValue(asThunkError(err.code, err.message, resetFlow));
    }
    return rejectWithValue(asThunkError("unknown", "Unable to verify code. Please try again."));
  }
});

export const performLogout = createAsyncThunk<void, void, { rejectValue: string }>(
  "auth/performLogout",
  async (_: void, { rejectWithValue }) => {
    try {
      const token = getAccessToken();
      await apiLogout(token);
      clearAccessToken();
    } catch (err: any) {
      clearAccessToken();
      return rejectWithValue(err?.message ?? "Logout failed");
    }
  }
);

/** ── Slice ───────────────────────────────────────────────────────────── */
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      clearAccessToken();
      state.token = null;
      state.isAuthenticated = false;
      state.authStep = "credentials";
      state.challengeId = null;
      state.challengeExpiresAt = null;
      state.error = null;
      // keep bootstrapped true; we already evaluated auth state
      state.bootstrapped = true;
      state.loading = false;
    },

    // Optional helper if you ever want to set token directly
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
      state.isAuthenticated = !!action.payload;
      state.authStep = action.payload ? "authenticated" : "credentials";
      state.challengeId = null;
      state.challengeExpiresAt = null;
      setAccessToken(action.payload);
    },
    resetAuthFlow(state) {
      clearAccessToken();
      state.token = null;
      state.isAuthenticated = false;
      state.authStep = "credentials";
      state.challengeId = null;
      state.challengeExpiresAt = null;
      state.error = null;
      state.loading = false;
    },
    expireOtpChallenge(state) {
      state.authStep = "credentials";
      state.challengeId = null;
      state.challengeExpiresAt = null;
      state.loading = false;
      state.error = "Invalid code or expired challenge.";
    },
  },
  extraReducers: (builder) => {
    // bootstrap
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.isAuthenticated = !!action.payload.token;
        state.authStep = action.payload.token ? "authenticated" : "credentials";
        state.challengeId = null;
        state.challengeExpiresAt = null;
        state.loading = false;
        state.bootstrapped = true;
      })
      .addCase(bootstrapAuth.rejected, (state, action) => {
        state.token = null;
        state.isAuthenticated = false;
        state.authStep = "credentials";
        state.challengeId = null;
        state.challengeExpiresAt = null;
        state.loading = false;
        state.bootstrapped = true;
        state.error = action.payload ?? "Bootstrap failed";
      });

    // password step
    builder
      .addCase(fetchAuthToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuthToken.fulfilled, (state, action) => {
        clearAccessToken();
        state.token = null;
        state.isAuthenticated = false;
        state.authStep = "otp_required";
        state.challengeId = action.payload.challengeId;
        state.challengeExpiresAt = action.payload.challengeExpiresAt;
        state.loading = false;
      })
      .addCase(fetchAuthToken.rejected, (state, action) => {
        state.loading = false;
        state.authStep = "credentials";
        state.challengeId = null;
        state.challengeExpiresAt = null;
        state.error = action.payload?.message ?? "Unable to sign in. Please try again.";
      });

    // OTP step
    builder
      .addCase(verifyOtpAndStoreToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtpAndStoreToken.fulfilled, (state, action) => {
        const token = action.payload;
        state.token = token;
        state.isAuthenticated = true;
        state.authStep = "authenticated";
        state.challengeId = null;
        state.challengeExpiresAt = null;
        state.loading = false;
        state.bootstrapped = true;
      })
      .addCase(verifyOtpAndStoreToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? "Unable to verify code. Please try again.";
        if (action.payload?.resetFlow) {
          state.isAuthenticated = false;
          state.token = null;
          state.authStep = "credentials";
          state.challengeId = null;
          state.challengeExpiresAt = null;
        }
      });

    builder
      .addCase(performLogout.fulfilled, (state) => {
        state.token = null;
        state.isAuthenticated = false;
        state.authStep = "credentials";
        state.challengeId = null;
        state.challengeExpiresAt = null;
        state.error = null;
        state.bootstrapped = true;
        state.loading = false;
      })
      .addCase(performLogout.rejected, (state) => {
        state.token = null;
        state.isAuthenticated = false;
        state.authStep = "credentials";
        state.challengeId = null;
        state.challengeExpiresAt = null;
        state.error = null;
        state.bootstrapped = true;
        state.loading = false;
      });
  },
});

export const { logout, setToken, resetAuthFlow, expireOtpChallenge } = authSlice.actions;
export default authSlice.reducer;
