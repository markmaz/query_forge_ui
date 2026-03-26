import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { useNewMenuList } from "./useNewMenuList";

vi.mock("@/shared/services/workspace", () => ({
  fetchWorkspaceExternalLinks: vi.fn().mockResolvedValue({
    workspace_id: "ws-1",
    datasource_type: null,
    links: [],
  }),
}));

vi.mock("@/features/semantic-admin/lib/useSemanticAdminPermissions", () => ({
  default: () => ({ canMutate: true }),
}));

function PlannerPoliciesProbe() {
  const menu = useNewMenuList();
  const systemAdmin = menu.find((item) => item.title === "System Admin");
  const dataFoundation = systemAdmin?.Items?.find((item) => item.title === "Data Foundation");
  const titles = dataFoundation?.menu?.map((item) => item.title).join(" | ") ?? "";
  return <div data-testid="data-foundation-items">{titles}</div>;
}

describe("useNewMenuList planner policies entry", () => {
  it("adds Planner Policies under System Admin > Data Foundation", () => {
    const store = createAppStore({
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
        needsWorkspaceSelection: false,
      },
    } as any);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <PlannerPoliciesProbe />
        </QueryClientProvider>
      </Provider>,
    );

    expect(screen.getByTestId("data-foundation-items").textContent).toContain("Planner Policies");
  });
});
