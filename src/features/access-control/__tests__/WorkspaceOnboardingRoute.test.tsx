import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { AppRoutes } from "@/app/navigation/AppRoutes";
import { routes } from "@/app/navigation/routes";
import { clearAccessToken, setAccessToken } from "@/shared/runtime/accessTokenStore";

const onboardingRoute = AppRoutes.find((entry) => entry.path === routes.AdminWorkspaceOnboarding);

vi.mock("@/features/system-admin/hooks", () => ({
  useOrganizations: () => ({
    data: { rows: [{ organization_id: "org-1", name: "Acme" }] },
  }),
  useWorkspaceBindings: () => ({
    data: {
      rows: [
        {
          workspace_id: "ws-1",
          workspace_name: "Workspace One",
          organization_id: "org-1",
          organization_name: "Acme",
          datasource_name: "Warehouse",
        },
      ],
    },
  }),
}));

vi.mock("../hooks/useAccessControl", () => ({
  useAccessUserSearch: () => ({ data: [], isLoading: false, isError: false }),
  useUpdateWorkspaceFeature: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
  useWorkspaceFeatures: () => ({ data: [], refetch: vi.fn() }),
  useWorkspaceReadiness: () => ({
    data: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

afterEach(() => {
  clearAccessToken();
});

function createToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function renderRoute(preloadedState: Record<string, unknown>) {
  const store = createAppStore(preloadedState as any);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[routes.AdminWorkspaceOnboarding]}>
          <Routes>
            <Route path={routes.AdminWorkspaceOnboarding} element={onboardingRoute?.element} />
            <Route path="/403" element={<div>Forbidden Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe("workspace onboarding route guard", () => {
  it("allows super admins", async () => {
    setAccessToken(createToken({ sub: "super-1", roles: ["super_admin"], is_admin: false }));

    renderRoute({
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
      userWorkspaces: {
        selectedWorkspaceId: "ws-1",
        workspaces: [],
        defaultWorkspace: null,
        loaded: true,
        loading: false,
        error: null,
      },
    });

    expect(await screen.findByRole("heading", { name: /workspace onboarding/i })).toBeInTheDocument();
  });

  it("blocks workspace admins", async () => {
    setAccessToken(createToken({ sub: "wa-1", roles: ["workspace_admin"], is_admin: false }));

    renderRoute({
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

    expect(await screen.findByText("Forbidden Page")).toBeInTheDocument();
  });
});
