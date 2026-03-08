import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { Buffer } from "buffer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AccountSettingsPanel from ".././AccountSettingsPanel";
import { createAppStore, type RootState } from "../../../../app/core/store";
import { server } from "../../../../qa/msw/server";
import { clearAccessToken, setAccessToken } from "../../../../shared/runtime/accessTokenStore";

const makeStore = (preloadedState?: Partial<RootState>) => createAppStore(preloadedState);

const renderPanel = (preloadedState?: Partial<RootState>) => {
  const store = makeStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AccountSettingsPanel />
      </QueryClientProvider>
    </Provider>
  );
};

const createToken = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
};

describe("AccountSettingsPanel", () => {
  const preloadedState: Partial<RootState> = {
    user: {
      user: {
        user_id: "user-123",
        first_name: "Casey",
        last_name: "Nguyen",
        email: "casey@example.com",
        status: "Active",
        last_log_in: "2026-02-10T16:30:00.000Z",
        two_factor_preference: "required",
        tos_accepted: true,
        eula_accepted: true,
      },
      rolesByProduct: {
        workspace: ["user"],
        "no code builder": ["admin", "user"],
      },
      capabilities: ["workspace:user", "no code builder:admin", "no code builder:user"],
      loading: false,
      initialized: true,
      error: null,
    } as RootState["user"],
  };

  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  beforeEach(() => {
    server.use(
      http.get("*/roles", () =>
        HttpResponse.json([
          { role_id: "admin", role_name: "Admin" },
          { role_id: "viewer", role_name: "Viewer" },
        ])
      ),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({
          user_id: "user-123",
          direct_roles: [{ role_id: "viewer", role_name: "Viewer" }],
          effective_roles: [
            { role_id: "viewer", role_name: "Viewer" },
            { role_id: "admin", role_name: "Admin" },
          ],
        })
      )
    );
  });

  afterEach(() => {
    server.resetHandlers();
    clearAccessToken();
  });

  it("renders core account management sections", () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["viewer"], is_admin: false }));
    renderPanel(preloadedState);

    expect(screen.getByRole("heading", { name: /profile details/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /security & password/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /my roles/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /^permissions$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /account summary/i })).toBeInTheDocument();
  });

  it("prefills first name, last name, and email from user profile", () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["viewer"], is_admin: false }));
    renderPanel(preloadedState);

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Casey");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Nguyen");
    expect(screen.getByLabelText(/email address/i)).toHaveValue("casey@example.com");
  });

  it("validates email and only enables profile save when dirty + valid", async () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["viewer"], is_admin: false }));
    renderPanel(preloadedState);
    const user = userEvent.setup();

    const saveButton = screen.getByRole("button", { name: /save profile changes/i });
    const emailInput = screen.getByLabelText(/email address/i);

    expect(saveButton).toBeDisabled();

    await user.clear(emailInput);
    await user.type(emailInput, "invalid-email");
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();

    await user.clear(emailInput);
    await user.type(emailInput, "updated@example.com");
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(screen.getByText(/profile changes staged/i)).toBeInTheDocument();
  });

  it("enables password reset action only when policy requirements are met", async () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["viewer"], is_admin: false }));
    renderPanel(preloadedState);
    const user = userEvent.setup();

    const resetButton = screen.getByRole("button", { name: /^reset password$/i });
    expect(resetButton).toBeDisabled();

    await user.type(screen.getByLabelText(/current password/i), "CurrentPassword123!");
    await user.type(screen.getByLabelText(/^new password$/i), "VeryStrongPassword123!");
    await user.type(screen.getByLabelText(/confirm new password/i), "VeryStrongPassword123!");

    expect(resetButton).toBeEnabled();
    await user.click(resetButton);
    expect(screen.getByText(/password reset flow staged/i)).toBeInTheDocument();
  });

  it("renders role and capability visibility data", () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["viewer"], is_admin: false }));
    renderPanel(preloadedState);

    expect(screen.getByRole("cell", { name: /workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /no code builder/i })).toBeInTheDocument();
    expect(screen.getByText("workspace:user")).toBeInTheDocument();
    expect(screen.getByText("no code builder:admin")).toBeInTheDocument();
  });

  it("shows my roles in read-only mode for non-admin users", async () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["viewer"], is_admin: false }));
    renderPanel(preloadedState);

    expect(await screen.findByText(/read-only access to direct role assignments/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save direct roles/i })).not.toBeInTheDocument();
  });

  it("shows editable role controls for admin users", async () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["admin"], is_admin: true }));
    renderPanel(preloadedState);

    expect(await screen.findByLabelText(/select direct roles/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save direct roles/i })).toBeInTheDocument();
  });

  it("shows authenticator as enabled when totp_enabled is true", () => {
    setAccessToken(createToken({ sub: "user-123", roles: ["viewer"], is_admin: false }));
    const stateWithTotpEnabled: Partial<RootState> = {
      ...preloadedState,
      user: {
        ...(preloadedState.user as RootState["user"]),
        user: {
          ...((preloadedState.user as RootState["user"]).user as Record<string, unknown>),
          two_factor_preference: null,
          totp_enabled: true,
        },
      } as RootState["user"],
    };

    renderPanel(stateWithTotpEnabled);
    const heading = screen.getByRole("heading", { name: /authenticator app/i });
    const card = heading.closest(".card");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText(/^enabled$/i)).toBeInTheDocument();
  });
});
