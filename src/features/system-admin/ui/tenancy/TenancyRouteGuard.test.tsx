import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { server } from "@/qa/msw/server";

vi.mock("@/shared/meta/runtime", () => ({
  appRuntimeConfig: {
    planDomainFastModeDefault: false,
    useWorkspaceIdPayloads: true,
    adminTenancyEnabled: true,
  },
  parseBooleanEnvFlag: (value: unknown) => {
    if (typeof value !== "string") return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  },
}));

async function renderTenancyOrganizationsRoute(preloadedState: Record<string, unknown>) {
  const [{ AppRoutes }, { routes }] = await Promise.all([
    import("@/app/navigation/AppRoutes"),
    import("@/app/navigation/routes"),
  ]);

  const organizationsRoute = AppRoutes.find((entry) => entry.path === routes.AdminTenancyOrganizations);

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
        <MemoryRouter initialEntries={[routes.AdminTenancyOrganizations]}>
          <Routes>
            <Route path={routes.AdminTenancyOrganizations} element={organizationsRoute?.element} />
            <Route path="/403" element={<div>Forbidden Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

describe("tenancy admin route guard", () => {
  it("allows admin users", async () => {
    server.use(
      http.get("*/admin/organizations", () =>
        HttpResponse.json({ rows: [], total: 0, limit: 25, offset: 0 })
      )
    );

    await renderTenancyOrganizationsRoute({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "admin-1" },
        rolesByFeature: { semantic: ["admin"] },
        capabilities: ["semantic:admin"],
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

    expect(await screen.findByRole("heading", { name: /organizations/i })).toBeInTheDocument();
  });

  it("blocks non-admin users", async () => {
    await renderTenancyOrganizationsRoute({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "user-1" },
        rolesByFeature: { semantic: ["user"] },
        capabilities: ["semantic:user"],
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
