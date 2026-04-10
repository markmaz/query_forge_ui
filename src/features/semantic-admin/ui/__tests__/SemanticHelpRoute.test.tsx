import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createAppStore } from "@/app/core/store";
import RequireRole from "@/app/navigation/guards/RequireRole";
import { routes } from "@/app/navigation/routes";

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
        <MemoryRouter initialEntries={[routes.SemanticHelp]}>
          <Routes>
            <Route
              path={routes.SemanticHelp}
              element={(
                <RequireRole feature="semantic" role="user">
                  <h1>Semantic Help</h1>
                </RequireRole>
              )}
            />
            <Route path="/403" element={<div>Forbidden Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe("semantic help route guard", () => {
  it("allows semantic users", async () => {
    renderRoute({
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

    expect(await screen.findByRole("heading", { name: /semantic help/i })).toBeInTheDocument();
  });

  it("blocks users without semantic access", async () => {
    renderRoute({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "user-1" },
        rolesByFeature: { semantic: [] },
        capabilities: [],
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
