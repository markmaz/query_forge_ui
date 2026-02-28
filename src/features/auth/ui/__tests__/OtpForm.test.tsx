import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import authReducer from "../../model/authSlice";
import OtpForm from ".././OtpForm";
import { AuthApiError } from "../../../../shared/services/auth";
import { clearAccessToken, getAccessToken } from "../../../../shared/lib/accessTokenStore";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  apiPost: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("react-toastify", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("../../../../shared/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/services/api")>("../../../../shared/services/api");
  return {
    ...actual,
    default: {
      post: mocks.apiPost,
    },
    refreshAccessToken: vi.fn(),
  };
});

const getToast = async () => (await import("react-toastify")).toast;

const initialAuthState = authReducer(undefined, { type: "@@INIT" });
type AuthState = ReturnType<typeof authReducer>;

const createStore = (overrides: Partial<AuthState> = {}) => {
  const preloadedAuthState: AuthState = {
    ...initialAuthState,
    authStep: "otp_required",
    challengeId: "challenge-1",
    challengeExpiresAt: Date.now() + 120_000,
    bootstrapped: true,
    ...overrides,
  };

  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: preloadedAuthState,
    },
  });
};

const renderForm = (overrides: Record<string, unknown> = {}) => {
  const store = createStore(overrides);
  render(
    <Provider store={store}>
      <MemoryRouter>
        <OtpForm />
      </MemoryRouter>
    </Provider>
  );
  return store;
};

const submitOtp = async (code: string) => {
  const user = userEvent.setup();
  const inputs = screen.getAllByRole("textbox");
  for (let i = 0; i < inputs.length; i += 1) {
    if (!code[i]) continue;
    await user.type(inputs[i], code[i]);
  }
  const form = screen.getByRole("button", { name: /submit/i }).closest("form");
  if (!form) throw new Error("OTP form not found");
  fireEvent.submit(form);
};

describe("OtpForm", () => {
  beforeEach(() => {
    clearAccessToken();
    vi.clearAllMocks();
  });

  it("verifies OTP, stores token, and navigates to app home", async () => {
    const store = renderForm();
    mocks.apiPost.mockResolvedValue({
      data: {
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 900,
      },
    });

    await submitOtp("123456");

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/otp/verify", {
        challenge_id: "challenge-1",
        otp: "123456",
      }, expect.any(Object));
      expect(mocks.navigate).toHaveBeenCalledWith("/home");
    });

    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.authStep).toBe("authenticated");
    expect(getAccessToken()).toBe("test-access-token");
  });

  it("normalizes shorter OTP values by left-padding to six digits", async () => {
    renderForm();
    mocks.apiPost.mockResolvedValue({
      data: {
        access_token: "test-access-token",
      },
    });

    await submitOtp("42");

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(
        "/otp/verify",
        {
          challenge_id: "challenge-1",
          otp: "000042",
        },
        expect.any(Object)
      );
      expect(mocks.navigate).toHaveBeenCalledWith("/home");
    });
  });

  it("normalizes localized digit characters before verify submit", async () => {
    renderForm();
    mocks.apiPost.mockResolvedValue({
      data: {
        access_token: "test-access-token",
      },
    });

    await submitOtp("١٢٣٤٥٦");

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(
        "/otp/verify",
        {
          challenge_id: "challenge-1",
          otp: "123456",
        },
        expect.any(Object)
      );
    });
  });

  it("disables browser-native form validation for OTP fields", () => {
    renderForm();
    const form = screen.getByRole("button", { name: /submit/i }).closest("form");
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute("novalidate");
  });

  it("returns to login on invalid/expired challenge", async () => {
    const toast = await getToast();
    const store = renderForm();
    mocks.apiPost.mockRejectedValue(
      new AuthApiError("invalid_or_expired_challenge", "Invalid code or expired challenge.", 401)
    );

    await submitOtp("123456");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid code or expired challenge.");
      expect(mocks.navigate).toHaveBeenCalledWith("/auth", { replace: true });
    });

    expect(store.getState().auth.authStep).toBe("credentials");
  });

  it("forces restart when challenge already expired", async () => {
    const toast = await getToast();
    renderForm({ challengeExpiresAt: Date.now() - 1 });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid code or expired challenge.");
      expect(mocks.navigate).toHaveBeenCalledWith("/auth", { replace: true });
    });
  });
});
