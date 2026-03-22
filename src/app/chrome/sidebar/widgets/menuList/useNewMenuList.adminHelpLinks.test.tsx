import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { useNewMenuList } from "./useNewMenuList";

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

function AdminHelpProbe() {
  const menu = useNewMenuList();
  const systemAdmin = menu.find((item) => item.title === "System Admin");
  const dataFoundation = systemAdmin?.Items?.find((item) => item.title === "Data Foundation");
  const tenancy = systemAdmin?.Items?.find((item) => item.title === "Tenancy");
  const dataFoundationLast = dataFoundation?.menu?.at(-1);
  const tenancyLast = tenancy?.menu?.at(-1);

  return (
    <div>
      <div data-testid="data-foundation-last-title">{dataFoundationLast?.title ?? ""}</div>
      <div data-testid="data-foundation-last-url">{dataFoundationLast?.url ?? ""}</div>
      <div data-testid="tenancy-last-title">{tenancyLast?.title ?? ""}</div>
      <div data-testid="tenancy-last-url">{tenancyLast?.url ?? ""}</div>
    </div>
  );
}

describe("useNewMenuList admin help links", () => {
  it("adds Help as the last item in Data Foundation and Tenancy", () => {
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
          <AdminHelpProbe />
        </QueryClientProvider>
      </Provider>,
    );

    expect(screen.getByTestId("data-foundation-last-title").textContent).toBe("Help");
    expect(screen.getByTestId("data-foundation-last-url").textContent).toBe("/admin/data-foundation/help");
    expect(screen.getByTestId("tenancy-last-title").textContent).toBe("Help");
    expect(screen.getByTestId("tenancy-last-url").textContent).toBe("/admin/tenancy/help");
  });
});
