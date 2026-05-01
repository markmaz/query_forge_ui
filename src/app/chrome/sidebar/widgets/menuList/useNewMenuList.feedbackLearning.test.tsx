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

function FeedbackLearningProbe() {
  const menu = useNewMenuList();
  const systemAdmin = menu.find((item) => item.title === "System Admin");
  const dataFoundation = systemAdmin?.Items?.find((item) => item.title === "Data Foundation");
  const titles = dataFoundation?.menu?.map((item) => item.title).join(" | ") ?? "";
  return <div data-testid="data-foundation-items">{titles}</div>;
}

describe("useNewMenuList feedback learning entry", () => {
  it("adds Feedback Learning under System Admin > Data Foundation", () => {
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
          <FeedbackLearningProbe />
        </QueryClientProvider>
      </Provider>,
    );

    expect(screen.getByTestId("data-foundation-items").textContent).toContain("Feedback Learning");
  });
});
