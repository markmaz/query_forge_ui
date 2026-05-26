import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Buffer } from "buffer";

import { createAppStore } from "@/app/core/store";
import { clearAccessToken, setAccessToken } from "@/shared/runtime/accessTokenStore";
import { useNewMenuList } from "./useNewMenuList";

const permissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/services/workspace", () => ({
  fetchWorkspaceExternalLinks: vi.fn().mockResolvedValue({
    workspace_id: "ws-1",
    datasource_type: null,
    links: [],
  }),
}));

vi.mock("@/features/semantic-admin/lib/useSemanticAdminPermissions", () => ({
  default: () => permissionMock(),
}));

function createToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function AdminSectionProbe() {
  const menu = useNewMenuList();
  const systemAdmin = menu.find((item) => item.title === "System Admin");
  const tenancy = systemAdmin?.Items?.find((item) => item.title === "Tenancy");
  return (
    <div>
      <div data-testid="system-admin-label">{systemAdmin?.title ?? ""}</div>
      <div data-testid="tenancy-label">{tenancy?.title ?? ""}</div>
    </div>
  );
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
        <AdminSectionProbe />
      </QueryClientProvider>
    </Provider>,
  );
}

describe("useNewMenuList admin access", () => {
  beforeEach(() => {
    permissionMock.mockReturnValue({ canMutate: false });
  });

  afterEach(() => {
    clearAccessToken();
    vi.clearAllMocks();
  });

  it("shows System Admin for workspace admins from effective roles", () => {
    setAccessToken(createToken({ sub: "wa-1", roles: [], is_admin: false }));

    renderProbe({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: {
          user_id: "wa-1",
          effective_roles: [{ role_id: "r1", role_name: "workspace_admin" }],
        },
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
    });

    expect(screen.getByTestId("system-admin-label").textContent).toBe("System Admin");
  });

  it("shows Tenancy by default for admins when no build flag is provided", () => {
    setAccessToken(createToken({ sub: "wa-1", roles: [], is_admin: false }));

    renderProbe({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: {
          user_id: "wa-1",
          effective_roles: [{ role_id: "r1", role_name: "workspace_admin" }],
        },
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
    });

    expect(screen.getByTestId("tenancy-label").textContent).toBe("Tenancy");
  });
});
