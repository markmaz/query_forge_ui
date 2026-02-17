import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordForm from ".././ResetPasswordForm";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  validateResetToken: vi.fn(),
  resetPassword: vi.fn(),
  locationSearch: "?token=reset-token-1",
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () =>
      ({
        pathname: "/auth/reset",
        search: mocks.locationSearch,
        hash: "",
        state: null,
        key: "test",
      }) as ReturnType<typeof actual.useLocation>,
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
    validateResetToken: mocks.validateResetToken,
    resetPassword: mocks.resetPassword,
  };
});

const renderForm = (search = "?token=reset-token-1") => {
  mocks.locationSearch = search;
  return render(
    <MemoryRouter>
      <ResetPasswordForm />
    </MemoryRouter>
  );
};

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locationSearch = "?token=reset-token-1";
    mocks.validateResetToken.mockResolvedValue({ ok: true });
    mocks.resetPassword.mockResolvedValue(undefined);
  });

  it("validates reset token from the query string", async () => {
    renderForm("?token=abc-token");

    await waitFor(() => {
      expect(mocks.validateResetToken).toHaveBeenCalledWith("abc-token");
    });
  });

  it("submits a new password and returns to login", async () => {
    renderForm("?token=abc-token");
    const user = userEvent.setup();
    const password = "StrongPassword123!";

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(2);

    await user.type(passwordInputs[0] as HTMLInputElement, password);
    await user.type(passwordInputs[1] as HTMLInputElement, password);
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(mocks.resetPassword).toHaveBeenCalledWith(password);
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Your password has been reset - please log in.");
      expect(mocks.navigate).toHaveBeenCalledWith("/auth");
    });
  });

  it("shows backend password-policy 422 message inline and in alert", async () => {
    renderForm("?token=abc-token");
    const user = userEvent.setup();
    const weakPassword = "WeakPassword123!";
    const policyMessage = "Password does not meet policy requirements.";

    mocks.resetPassword.mockRejectedValue(new Error(policyMessage));

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(2);

    await user.type(passwordInputs[0] as HTMLInputElement, weakPassword);
    await user.type(passwordInputs[1] as HTMLInputElement, weakPassword);
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(policyMessage);
    expect((await screen.findAllByText(policyMessage)).length).toBeGreaterThanOrEqual(2);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect((passwordInputs[0] as HTMLInputElement).value).toBe(weakPassword);
  });
});
