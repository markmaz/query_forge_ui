import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";

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

async function renderRoute(preloadedState: Record<string, unknown>) {
  const [{ AppRoutes }, { routes }] = await Promise.all([
    import("@/app/navigation/AppRoutes"),
    import("@/app/navigation/routes"),
  ]);

  const helpRoute = AppRoutes.find((entry) => entry.path === routes.AdminTenancyHelp);

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
        <MemoryRouter initialEntries={[routes.AdminTenancyHelp]}>
          <Routes>
            <Route path={routes.AdminTenancyHelp} element={helpRoute?.element} />
            <Route path="/403" element={<div>Forbidden Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe("tenancy help route guard", () => {
  it("allows admin users", async () => {
    await renderRoute({
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

    expect(await screen.findByRole("heading", { name: /tenancy help/i })).toBeInTheDocument();
  });

  it("blocks non-admin users", async () => {
    await renderRoute({
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
