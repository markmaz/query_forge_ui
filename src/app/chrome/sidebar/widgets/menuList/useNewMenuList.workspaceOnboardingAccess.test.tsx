import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { clearAccessToken, setAccessToken } from "@/shared/runtime/accessTokenStore";
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

function createToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function OnboardingMenuProbe() {
  const menu = useNewMenuList();
  const adminSection = menu.find((item) => item.title === "Admin");
  const onboardingItem = adminSection?.Items?.find((item) => item.title === "Workspace Onboarding");
  return <div data-testid="onboarding-label">{onboardingItem?.title ?? ""}</div>;
}

function renderProbe(preloadedState: Record<string, unknown>) {
  const store = createAppStore(preloadedState as any);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <OnboardingMenuProbe />
      </QueryClientProvider>
    </Provider>,
  );
}

afterEach(() => {
  clearAccessToken();
});

describe("useNewMenuList workspace onboarding access", () => {
  it("shows workspace onboarding for super admins", async () => {
    setAccessToken(createToken({ sub: "super-1", roles: ["super_admin"], is_admin: false }));

    renderProbe({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: {
          user_id: "super-1",
          effective_roles: [{ role_id: "r1", role_name: "super_admin" }],
        },
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
    });

    expect(screen.getByTestId("onboarding-label").textContent).toBe("Workspace Onboarding");
  });

  it("hides workspace onboarding for workspace admins", async () => {
    setAccessToken(createToken({ sub: "wa-1", roles: ["workspace_admin"], is_admin: false }));

    renderProbe({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: {
          user_id: "wa-1",
          effective_roles: [{ role_id: "r1", role_name: "workspace_admin" }],
        },
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
    });

    expect(screen.getByTestId("onboarding-label").textContent).toBe("");
  });
});
