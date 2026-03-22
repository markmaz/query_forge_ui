import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { clearAccessToken, setAccessToken } from "@/shared/runtime/accessTokenStore";
import WorkspaceFeatureManagementPage from "../pages/WorkspaceFeatureManagementPage";

const mutateAsync = vi.fn();

vi.mock("@/features/system-admin/hooks", () => ({
  useOrganizations: () => ({
    data: { rows: [{ organization_id: "org1", name: "Acme" }] },
  }),
  useWorkspaceBindings: () => ({
    data: {
      rows: [
        {
          workspace_id: "ws1",
          workspace_name: "Workspace One",
          organization_id: "org1",
          organization_name: "Acme",
          datasource_name: "Warehouse",
        },
      ],
    },
  }),
}));

vi.mock("../hooks/useAccessControl", () => ({
  useWorkspaceFeatures: () => ({
    data: [
      { workspace_id: "ws1", feature_key: "skills", enabled: true, updated_at: null, updated_by: null, note: null },
      { workspace_id: "ws1", feature_key: "forge_match", enabled: false, updated_at: null, updated_by: null, note: null },
    ],
  }),
  useWorkspaceReadiness: () => ({
    data: {
      workspace_id: "ws1",
      workspace_name: "Workspace One",
      has_workspace_admin: true,
      enabled_feature_count: 2,
      super_user_present: false,
      setup_complete: false,
      completed_steps: [],
      missing_steps: ["super user"],
    },
    isLoading: false,
    isError: false,
  }),
  useUpdateWorkspaceFeature: () => ({
    mutateAsync,
    isPending: false,
    variables: undefined,
  }),
}));

describe("WorkspaceFeatureManagementPage", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
  });

  afterEach(() => {
    clearAccessToken();
  });

  function createToken(payload: Record<string, unknown>) {
    const encode = (value: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
  }

  function renderPage(preloadedState?: Record<string, unknown>) {
    const store = createAppStore(
      (preloadedState ??
        {
          auth: { isAuthenticated: true, bootstrapped: true },
          user: {
            user: {
              user_id: "super-1",
              effective_roles: [{ role_id: "r1", role_name: "super_admin" }],
            },
            rolesByFeature: { system: ["admin"] },
            capabilities: ["system:admin"],
            loading: false,
            initialized: true,
            error: null,
          },
        }) as any,
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });

    return render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WorkspaceFeatureManagementPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    );
  }

  it("renders workspace features and toggles a feature", async () => {
    setAccessToken(createToken({ sub: "super-1", roles: ["super_admin"], is_admin: false }));

    renderPage();

    expect(screen.getByText("Workspace Features")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open onboarding/i })).toBeInTheDocument();

    const toggles = screen.getAllByRole("switch");
    await userEvent.click(toggles[0]);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });
  });

  it("hides the onboarding link for workspace admins", () => {
    setAccessToken(createToken({ sub: "wa-1", roles: ["workspace_admin"], is_admin: false }));

    renderPage({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: {
          user_id: "wa-1",
          effective_roles: [{ role_id: "r1", role_name: "workspace_admin" }],
        },
        rolesByFeature: { system: ["admin"] },
        capabilities: ["system:admin"],
        loading: false,
        initialized: true,
        error: null,
      },
      userWorkspaces: {
        selectedWorkspaceId: "ws-1",
        workspaces: [],
        defaultWorkspace: null,
        loaded: true,
        loading: false,
        error: null,
      },
    });

    expect(screen.queryByRole("link", { name: /open onboarding/i })).not.toBeInTheDocument();
  });
});
