import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { describe, beforeEach, expect, it, vi } from "vitest";
import authReducer from "../../model/authSlice";
import SignInForm from ".././SignInForm";
import { AuthApiError } from "../../../../shared/services/auth";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  login: vi.fn(),
  verifyOtp: vi.fn(),
  logout: vi.fn(),
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

vi.mock("../../../../shared/services/auth", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/services/auth")>("../../../../shared/services/auth");
  return {
    ...actual,
    login: mocks.login,
    verifyOtp: mocks.verifyOtp,
    logout: mocks.logout,
  };
});

const getToast = async () => (await import("react-toastify")).toast;

const createStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
    },
  });

const renderForm = () => {
  const store = createStore();
  render(
    <Provider store={store}>
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    </Provider>
  );
  return store;
};

const fillCredentialsAndSubmit = async () => {
  const user = userEvent.setup();
  const usernameInput = screen.getByRole("textbox");
  const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
  const signInButton = screen.getByRole("button", { name: /sign in/i });

  await user.clear(usernameInput);
  await user.type(usernameInput, "user@example.com");
  await user.type(passwordInput, "Password123!");
  await user.click(signInButton);
};

describe("SignInForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to OTP screen after successful credentials", async () => {
    const store = renderForm();
    mocks.login.mockResolvedValue({
      requires_otp: true,
      challenge_id: "challenge-1",
      challenge_expires_in: 300,
    });

      await fillCredentialsAndSubmit();

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/auth/otp");
    });
    expect(store.getState().auth.authStep).toBe("otp_required");
  });

  it("shows generic message for invalid username/password", async () => {
    const toast = await getToast();
    renderForm();
    mocks.login.mockRejectedValue(
      new AuthApiError("invalid_username_or_password", "Invalid username or password.", 401)
    );

    await fillCredentialsAndSubmit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid username or password.");
    });
  });

  it("normalizes any 401 login failure to generic auth message", async () => {
    const toast = await getToast();
    renderForm();
    mocks.login.mockRejectedValue(
      new AuthApiError("unknown", "User is inactive", 401)
    );

    await fillCredentialsAndSubmit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid username or password.");
    });
  });

  it("shows generic message for too many attempts", async () => {
    const toast = await getToast();
    renderForm();
    mocks.login.mockRejectedValue(
      new AuthApiError("too_many_attempts", "Too many attempts. Please wait and try again.", 429)
    );

    await fillCredentialsAndSubmit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Too many attempts. Please wait and try again.");
    });
  });
});
