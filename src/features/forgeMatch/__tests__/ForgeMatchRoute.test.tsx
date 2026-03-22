import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { AppRoutes } from "@/app/navigation/AppRoutes";
import { routes } from "@/app/navigation/routes";

vi.mock("@/features/forgeMatch/api", () => ({
  listForgeMatchSessions: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, page_size: 25 }),
  uploadForgeMatchDocument: vi.fn(),
  startForgeMatchAnalyzeSession: vi.fn(),
  fetchForgeMatchAnalyzeStatus: vi.fn(),
  cancelForgeMatchAnalyzeSession: vi.fn(),
  fetchForgeMatchAnalyzeHistory: vi.fn(),
  fetchForgeMatchSession: vi.fn(),
  updateForgeMatchMappings: vi.fn(),
  exportForgeMatchSession: vi.fn(),
  createForgeMatchDraft: vi.fn(),
}));

vi.mock("@/shared/services/queryStudioAdminApi", () => ({
  fetchBuilderDomains: vi.fn().mockResolvedValue({ rows: [] }),
}));

const forgeMatchRoute = AppRoutes.find((entry) => entry.path === routes.ForgeMatch);

function renderRoute(preloadedState: Record<string, unknown>) {
  const store = createAppStore(preloadedState as any);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[routes.ForgeMatch]}>
          <Routes>
            <Route path={routes.ForgeMatch} element={forgeMatchRoute?.element} />
            <Route path="/403" element={<div>Forbidden Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

describe("ForgeMatch route guard", () => {
  it("allows users with forge_match access", async () => {
    renderRoute({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "user-1" },
        rolesByFeature: { forge_match: ["user"] },
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

    expect(await screen.findByRole("heading", { name: /forgematch/i })).toBeInTheDocument();
  });

  it("blocks users without forge_match access", async () => {
    renderRoute({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "user-2" },
        rolesByFeature: { forge_insights: ["user"] },
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
