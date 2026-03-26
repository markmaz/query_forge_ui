import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { AppRoutes } from "@/app/navigation/AppRoutes";
import { routes } from "@/app/navigation/routes";

vi.mock("@/shared/services/queryStudioAdminApi", () => ({
  fetchDomains: async () => ({ rows: [] }),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  usePlannerDomainCapabilities: () => ({ data: { capabilities: [] }, isLoading: false }),
  usePlannerRerankPolicies: () => ({ data: { policies: [] }, isLoading: false }),
  usePlannerRerankPolicyCandidates: () => ({ data: { candidates: [] }, isLoading: false }),
  useUpsertPlannerDomainCapability: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePlannerDomainCapability: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpsertPlannerRerankPolicy: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePlannerRerankPolicy: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePlannerRerankPolicyCandidate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePlannerRerankPolicyCandidate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSuggestPlannerRerankPolicyCandidate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApprovePlannerRerankPolicyCandidate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const adminRoute = AppRoutes.find((entry) => entry.path === routes.AdminPlannerPolicies);

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
        <MemoryRouter initialEntries={[routes.AdminPlannerPolicies]}>
          <Routes>
            <Route path={routes.AdminPlannerPolicies} element={adminRoute?.element} />
            <Route path="/403" element={<div>Forbidden Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe("planner policies route guard", () => {
  it("allows admin users", async () => {
    renderRoute({
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

    expect(await screen.findByRole("heading", { name: /planner policies/i })).toBeInTheDocument();
  });

  it("blocks non-admin users", async () => {
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

    expect(await screen.findByText("Forbidden Page")).toBeInTheDocument();
  });
});
