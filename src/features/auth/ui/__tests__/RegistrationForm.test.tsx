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
  acceptInvite: vi.fn(),
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
    acceptInvite: mocks.acceptInvite,
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
    mocks.acceptInvite.mockResolvedValue({
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
    expect(alert).toHaveTextContent("Invite link invalid or expired");
    expect(screen.queryByText(backendMessage)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept invite/i })).toBeDisabled();
  });

  it("submits invite accept payload and routes to login", async () => {
    renderForm("?token=invite-abc");
    const user = userEvent.setup();
    const strongPassword = "StrongPassword123!@";

    await screen.findByText(/invited as invitee@example\.com/i);
    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    const emailInput = screen.getByLabelText(/^email$/i);
    await user.clear(emailInput);
    await user.type(emailInput, "invitee@example.com");
    await user.type(screen.getByLabelText(/^password$/i), strongPassword);
    await user.type(screen.getByLabelText(/confirm password/i), strongPassword);

    await user.click(screen.getByRole("button", { name: /accept invite/i }));

    await waitFor(() => {
      expect(mocks.acceptInvite).toHaveBeenCalledWith("invite-abc", {
        first_name: "Jane",
        last_name: "Doe",
        password: strongPassword,
        email: "invitee@example.com",
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Invite accepted");
      expect(mocks.navigate).toHaveBeenCalledWith("/auth");
    });
  });

  it("maps backend status codes to invite onboarding messages", async () => {
    renderForm("?token=invite-abc");
    const user = userEvent.setup();
    const strongPassword = "StrongPassword123!@";
    const error400 = new Error("bad token") as Error & { status?: number };
    error400.status = 400;
    mocks.acceptInvite.mockRejectedValueOnce(error400);

    await screen.findByText(/invited as invitee@example\.com/i);
    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    const emailInput = screen.getByLabelText(/^email$/i);
    await user.clear(emailInput);
    await user.type(emailInput, "invitee@example.com");
    await user.type(screen.getByLabelText(/^password$/i), strongPassword);
    await user.type(screen.getByLabelText(/confirm password/i), strongPassword);
    await user.click(screen.getByRole("button", { name: /accept invite/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invite link invalid or expired");

    const error403 = new Error("email mismatch") as Error & { status?: number };
    error403.status = 403;
    mocks.acceptInvite.mockRejectedValueOnce(error403);
    await user.click(screen.getByRole("button", { name: /accept invite/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invite email mismatch");

    const error409 = new Error("already used") as Error & { status?: number };
    error409.status = 409;
    mocks.acceptInvite.mockRejectedValueOnce(error409);
    await user.click(screen.getByRole("button", { name: /accept invite/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invite already used");
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/^password$/i) as HTMLInputElement).value).toBe(strongPassword);
  });
});
