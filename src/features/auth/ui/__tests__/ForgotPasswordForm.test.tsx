import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordForm from ".././ForgotPasswordForm";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  resetPasswordRequest: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../../../../shared/services/auth", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/services/auth")>("../../../../shared/services/auth");
  return {
    ...actual,
    resetPasswordRequest: mocks.resetPasswordRequest,
  };
});

const renderForm = () =>
  render(
    <MemoryRouter>
      <ForgotPasswordForm />
    </MemoryRouter>
  );

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates required email before submitting", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/email address is required/i)).toBeInTheDocument();
    expect(mocks.resetPasswordRequest).not.toHaveBeenCalled();
  });

  it("submits reset request and routes to success screen", async () => {
    renderForm();
    const user = userEvent.setup();
    mocks.resetPasswordRequest.mockResolvedValue({ ok: true });

    await user.type(screen.getByRole("textbox"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mocks.resetPasswordRequest).toHaveBeenCalledWith("user@example.com");
      expect(mocks.navigate).toHaveBeenCalledWith("/auth/forgot_success");
    });
  });

  it("still routes to generic success screen when reset request fails", async () => {
    renderForm();
    const user = userEvent.setup();
    mocks.resetPasswordRequest.mockRejectedValue(new Error("Email not found"));

    await user.type(screen.getByRole("textbox"), "missing@example.com");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mocks.resetPasswordRequest).toHaveBeenCalledWith("missing@example.com");
      expect(mocks.navigate).toHaveBeenCalledWith("/auth/forgot_success");
    });
  });
});
