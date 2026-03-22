import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import authReducer from "../../model/authSlice";
import TotpForm from "../TotpForm";
import { AuthApiError } from "../../../../shared/services/auth";
import { clearAccessToken, getAccessToken } from "../../../../shared/runtime/accessTokenStore";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  apiPost: vi.fn(),
  toastError: vi.fn(),
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
  },
}));

vi.mock("../../../../shared/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/services/api")>(
    "../../../../shared/services/api"
  );
  return {
    ...actual,
    default: {
      post: mocks.apiPost,
    },
    refreshAccessToken: vi.fn(),
  };
});

const initialAuthState = authReducer(undefined, { type: "@@INIT" });
type AuthState = ReturnType<typeof authReducer>;

const createStore = (overrides: Partial<AuthState> = {}) =>
  configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        ...initialAuthState,
        authStep: "otp_required",
        mfaType: "totp",
        challengeId: "challenge-totp-1",
        challengeExpiresAt: Date.now() + 120_000,
        bootstrapped: true,
        ...overrides,
      },
    } as any,
  } as any);

const renderForm = (overrides: Partial<AuthState> = {}) => {
  const store = createStore(overrides);
  render(
    <Provider store={store}>
      <MemoryRouter>
        <TotpForm />
      </MemoryRouter>
    </Provider>
  );
  return store;
};

const submitCode = async (code: string) => {
  const user = userEvent.setup();
  const inputs = screen.getAllByRole("textbox");
  for (let i = 0; i < inputs.length; i += 1) {
    if (!code[i]) continue;
    await user.type(inputs[i], code[i]);
  }
  const form = screen.getByRole("button", { name: /submit/i }).closest("form");
  if (!form) throw new Error("TOTP form not found");
  fireEvent.submit(form);
};

describe("TotpForm", () => {
  beforeEach(() => {
    clearAccessToken();
    vi.clearAllMocks();
  });

  it("verifies TOTP challenge and navigates to home", async () => {
    const store = renderForm();
    mocks.apiPost.mockResolvedValue({
      data: {
        access_token: "totp-token",
      },
    });

    await submitCode("123456");

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(
        "/auth/mfa/totp/verify",
        {
          challenge_id: "challenge-totp-1",
          code: "123456",
        },
        expect.any(Object)
      );
      expect(mocks.navigate).toHaveBeenCalledWith("/home");
    });

    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.authStep).toBe("authenticated");
    expect(getAccessToken()).toBe("totp-token");
  });

  it("shows generic invalid-code message on 401", async () => {
    renderForm();
    mocks.apiPost.mockRejectedValue(
      new AuthApiError("invalid_mfa_code", "Invalid authenticator code.", 401)
    );

    await submitCode("123456");

    await waitFor(() => {
      expect(screen.getByText("Invalid code or expired challenge.")).toBeInTheDocument();
    });
  });

  it("shows retry later message on 429", async () => {
    renderForm();
    mocks.apiPost.mockRejectedValue(
      new AuthApiError("retry_later", "Too many attempts. Please try again later.", 429)
    );

    await submitCode("123456");

    await waitFor(() => {
      expect(screen.getByText("Too many attempts. Please try again later.")).toBeInTheDocument();
    });
  });
});
