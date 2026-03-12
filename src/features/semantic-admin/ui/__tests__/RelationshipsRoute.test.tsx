import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { AppRoutes } from "@/app/navigation/AppRoutes";
import { routes } from "@/app/navigation/routes";

vi.mock("@/shared/services/semantic", async (importActual) => {
  const actual = await importActual<typeof import("@/shared/services/semantic")>();
  return {
    ...actual,
    listSemanticRelationships: async () => ({ items: [], page: 1, page_size: 25, total: 0 }),
    listSemanticRelationshipConcepts: async () => ({ items: [], page: 1, page_size: 25, total: 0 }),
    getSemanticRelationship: async () => ({
      id: 1,
      parent_concept_id: 1,
      child_concept_id: 2,
      relationship_type: "depends_on",
      vertical_norm: null,
      parent_concept_name: null,
      child_concept_name: null,
      parent_display_label: null,
      child_display_label: null,
      created_at: null,
      updated_at: null,
    }),
  };
});

const relationshipsRoute = AppRoutes.find((entry) => entry.path === routes.AdminSemanticRelationships);

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
        <MemoryRouter initialEntries={[routes.AdminSemanticRelationships]}>
          <Routes>
            <Route path={routes.AdminSemanticRelationships} element={relationshipsRoute?.element} />
            <Route path="/403" element={<div>Forbidden Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

describe("semantic relationships route guard", () => {
  it("allows admin users", async () => {
    renderRoute({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "admin-1" },
        rolesByProduct: { semantic: ["admin"] },
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

    expect(await screen.findByRole("heading", { name: /semantic relationships/i })).toBeInTheDocument();
  });

  it("blocks non-admin users", async () => {
    renderRoute({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "user-1" },
        rolesByProduct: { semantic: ["user"] },
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
