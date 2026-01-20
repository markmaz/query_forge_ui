import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { login, verifyOtp } from "../../../shared/api/auth";

/** ── Types ───────────────────────────────────────────────────────────── */
interface LoginPayload {
  username: string;
  password: string;
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;

  loading: boolean;
  bootstrapped: boolean;
  error: string | null;
}

/** ── Initial State ───────────────────────────────────────────────────── */
const tokenFromStorage = localStorage.getItem("Token");

const initialState: AuthState = {
  token: tokenFromStorage,
  isAuthenticated: !!tokenFromStorage,
  userId: null,
  email: null,

  loading: false,
  bootstrapped: false,
  error: null,
};

/** ── Thunks ──────────────────────────────────────────────────────────── */
/** On app start: rehydrate token from storage (and optionally fetch profile) */
export const bootstrapAuth = createAsyncThunk<
  { token: string | null },
  void,
  { rejectValue: string }
>("auth/bootstrap", async (_: void, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem("Token");
    return { token: token ?? null };
  } catch {
    return rejectWithValue("Bootstrap failed");
  }
});

/** Step 1: username/password – returns user_id + email for OTP step */
export const fetchAuthToken = createAsyncThunk<
  { user_id: string; email: string },
  LoginPayload,
  { rejectValue: string }
>("auth/fetchAuthToken", async (credentials, { rejectWithValue }) => {
  try {
    const data = await login(credentials);
    return { user_id: data.user_id, email: data.email };
  } catch (err: any) {
    return rejectWithValue(err?.message ?? "Login failed");
  }
});

/** Step 2: OTP – returns JWT; we persist and mark authenticated */
export const verifyOtpAndStoreToken = createAsyncThunk<
  string,
  { user_id: string; otp: string },
  { rejectValue: string }
>("auth/verifyOtpAndStoreToken", async ({ user_id, otp }, { rejectWithValue }) => {
  try {
    const data = await verifyOtp({ user_id, otp });
    const token = data?.token;

    if (!token) return rejectWithValue("Failed to verify OTP");

    localStorage.setItem("Token", token);
    return token;
  } catch (err: any) {
    return rejectWithValue(err?.message ?? "Failed to verify OTP");
  }
});

/** ── Slice ───────────────────────────────────────────────────────────── */
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      localStorage.removeItem("Token");
      state.token = null;
      state.isAuthenticated = false;
      state.userId = null;
      state.email = null;
      state.error = null;
      // keep bootstrapped true; we already evaluated auth state
      state.bootstrapped = true;
      state.loading = false;
    },

    // Optional helper if you ever want to set token directly
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
      state.isAuthenticated = !!action.payload;
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
        state.loading = false;
        state.bootstrapped = true;
      })
      .addCase(bootstrapAuth.rejected, (state, action) => {
        state.token = null;
        state.isAuthenticated = false;
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
        state.userId = action.payload.user_id;
        state.email = action.payload.email;
        state.loading = false;
      })
      .addCase(fetchAuthToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Login failed";
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
        state.loading = false;
        state.bootstrapped = true;
      })
      .addCase(verifyOtpAndStoreToken.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.token = null;
        state.error = action.payload ?? "OTP verification failed";
      });
  },
});

export const { logout, setToken } = authSlice.actions;
export default authSlice.reducer;