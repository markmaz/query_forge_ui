import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegistrationForm from ".././RegistrationForm";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  validateInviteToken: vi.fn(),
  registerUser: vi.fn(),
  locationSearch: "?token=invite-token-1",
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () =>
      ({
        pathname: "/auth/register",
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

vi.mock("../../../../shared/services/users", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/services/users")>("../../../../shared/services/users");
  return {
    ...actual,
    validateInviteToken: mocks.validateInviteToken,
    registerUser: mocks.registerUser,
  };
});

const renderForm = (search = "?token=invite-token-1") => {
  mocks.locationSearch = search;
  return render(
    <MemoryRouter>
      <RegistrationForm />
    </MemoryRouter>
  );
};

describe("RegistrationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locationSearch = "?token=invite-token-1";
    mocks.validateInviteToken.mockResolvedValue({
      user_id: "user-1",
      email: "invitee@example.com",
    });
    mocks.registerUser.mockResolvedValue({
      user_id: "user-1",
      email: "invitee@example.com",
    });
  });

  it("loads invite context from token and renders invited email", async () => {
    renderForm("?token=invite-abc");

    await waitFor(() => {
      expect(mocks.validateInviteToken).toHaveBeenCalledWith("invite-abc");
    });
    expect(await screen.findByText(/invited as invitee@example\.com/i)).toBeInTheDocument();
  });

  it("shows generic invite error for non-200 token validation failures", async () => {
    const backendMessage = "Token belongs to deactivated user";
    mocks.validateInviteToken.mockRejectedValue(new Error(backendMessage));
    renderForm("?token=invite-abc");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid or expired invitation link.");
    expect(screen.queryByText(backendMessage)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register/i })).toBeDisabled();
  });

  it("submits registration payload and routes to registration success", async () => {
    renderForm("?token=invite-abc");
    const user = userEvent.setup();
    const strongPassword = "StrongPassword123!";

    await screen.findByText(/invited as invitee@example\.com/i);
    const textInputs = screen.getAllByRole("textbox");
    expect(textInputs.length).toBeGreaterThanOrEqual(2);
    await user.type(textInputs[0], "Jane");
    await user.type(textInputs[1], "Doe");

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(2);
    await user.type(passwordInputs[0] as HTMLInputElement, strongPassword);
    await user.type(passwordInputs[1] as HTMLInputElement, strongPassword);

    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(mocks.registerUser).toHaveBeenCalledWith({
        first_name: "Jane",
        last_name: "Doe",
        password: strongPassword,
        user_id: "user-1",
        email: "invitee@example.com",
        status: "Active",
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("You registered successfully. Please log in.");
      expect(mocks.navigate).toHaveBeenCalledWith("/auth/success");
    });
  });

  it("shows backend password-policy 422 message inline and in alert", async () => {
    renderForm("?token=invite-abc");
    const user = userEvent.setup();
    const weakPassword = "WeakPassword123!";
    const policyMessage = "Password has been found in breach corpus. Choose a different password.";

    mocks.registerUser.mockRejectedValue(new Error(policyMessage));

    await screen.findByText(/invited as invitee@example\.com/i);
    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Jane");
    await user.type(textInputs[1], "Doe");

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
