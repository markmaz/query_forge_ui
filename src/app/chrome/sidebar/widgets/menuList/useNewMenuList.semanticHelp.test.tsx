import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { useNewMenuList } from "./useNewMenuList";

let canMutateMock = true;

vi.mock("@/shared/services/workspace", () => ({
  fetchWorkspaceExternalLinks: vi.fn().mockResolvedValue({
    workspace_id: "ws-1",
    datasource_type: null,
    links: [],
  }),
}));

vi.mock("@/features/semantic-admin/lib/useSemanticAdminPermissions", () => ({
  default: () => ({ canMutate: canMutateMock }),
}));

function SemanticRegistryProbe() {
  const menu = useNewMenuList();
  const section = menu.find((item) => item.title === "System Admin");
  const semanticRegistry = section?.Items?.find((item) => item.title === "Semantic Registry");
  const labels = semanticRegistry?.menu?.map((item) => item.title).join(" | ") ?? "";
  const lastItem = semanticRegistry?.menu?.at(-1);
  const standaloneSection = menu.find((item) => item.title === "Semantic Registry");
  const standaloneHelp = standaloneSection?.Items?.at(0);

  return (
    <div>
      <div data-testid="semantic-registry-labels">{labels}</div>
      <div data-testid="semantic-registry-last-title">{lastItem?.title ?? ""}</div>
      <div data-testid="semantic-registry-last-url">{lastItem?.url ?? ""}</div>
      <div data-testid="standalone-semantic-title">{standaloneSection?.title ?? ""}</div>
      <div data-testid="standalone-semantic-help-title">{standaloneHelp?.title ?? ""}</div>
      <div data-testid="standalone-semantic-help-url">{standaloneHelp?.url ?? ""}</div>
    </div>
  );
}

describe("useNewMenuList semantic help", () => {
  beforeEach(() => {
    canMutateMock = true;
  });

  it("adds Help as the last Semantic Registry item for admins", async () => {
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
          <SemanticRegistryProbe />
        </QueryClientProvider>
      </Provider>,
    );

    expect(screen.getByTestId("semantic-registry-labels").textContent).toContain("Catalog Builder | Help");
    expect(screen.getByTestId("semantic-registry-last-title").textContent).toBe("Help");
    expect(screen.getByTestId("semantic-registry-last-url").textContent).toBe("/semantic/help");
  });

  it("shows a Semantic Registry help section for semantic users without admin access", async () => {
    canMutateMock = false;

    const store = createAppStore({
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
          <SemanticRegistryProbe />
        </QueryClientProvider>
      </Provider>,
    );

    expect(screen.getByTestId("standalone-semantic-title").textContent).toBe("Semantic Registry");
    expect(screen.getByTestId("standalone-semantic-help-title").textContent).toBe("Help");
    expect(screen.getByTestId("standalone-semantic-help-url").textContent).toBe("/semantic/help");
  });
});
