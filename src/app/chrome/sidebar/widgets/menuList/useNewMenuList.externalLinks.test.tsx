import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import { setSelectedWorkspace } from "@/features/preferences/model/settingsSlice";
import type { MenuItem } from "@/domain-model/Layout";
import { fetchWorkspaceExternalLinks } from "@/shared/services/workspace";
import SubMenu from "./SubMenu";
import { useNewMenuList } from "./useNewMenuList";

vi.mock("@/shared/services/workspace", () => ({
  fetchWorkspaceExternalLinks: vi.fn(),
}));

vi.mock("@/features/semantic-admin/lib/useSemanticAdminPermissions", () => ({
  default: () => ({ canMutate: false }),
}));

const mockedFetchWorkspaceExternalLinks = vi.mocked(fetchWorkspaceExternalLinks);

function createStore(selectedWorkspaceId = "ws-1") {
  return createAppStore({
    auth: { isAuthenticated: true, bootstrapped: true },
    user: {
      user: { user_id: "u-1" },
      rolesByFeature: { workspaces: ["user"] },
      capabilities: ["workspaces:user"],
      loading: false,
      initialized: true,
      error: null,
    },
    userWorkspaces: {
      selectedWorkspaceId,
      workspaces: [
        { workspace_id: "ws-1", name: "Workspace 1", server: "https://old.example", is_default: 1 },
        { workspace_id: "ws-2", name: "Workspace 2", server: "https://old2.example", is_default: 0 },
      ],
      defaultWorkspace: { workspace_id: "ws-1", name: "Workspace 1", server: "https://old.example", is_default: 1 },
      loaded: true,
      loading: false,
      error: null,
      needsWorkspaceSelection: false,
    },
  } as any);
}

function ExternalLinksProbe() {
  const menu = useNewMenuList();
  const section = menu.find((item) => item.title === "External Links");
  const child = section?.Items?.[0];
  return (
    <div>
      <div data-testid="external-label">{child?.title ?? ""}</div>
      <div data-testid="external-url">{child?.url ?? ""}</div>
      <div data-testid="external-disabled">{String(Boolean(child?.disabled))}</div>
    </div>
  );
}

function renderProbe(store = createStore()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });
  const view = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ExternalLinksProbe />
      </QueryClientProvider>
    </Provider>
  );
  return { ...view, store };
}

function ExternalSubmenuProbe() {
  const [activeMenu, setActiveMenu] = useState<MenuItem[]>([]);
  return (
    <ul>
      <SubMenu
        menu={[
          {
            title: "Databricks",
            url: "https://dbc.example.com/sql/warehouses/123",
            type: "link",
          },
        ]}
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        level={0}
      />
    </ul>
  );
}

function renderSubmenu(store = createStore()) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ExternalSubmenuProbe />
      </MemoryRouter>
    </Provider>
  );
}

describe("useNewMenuList external links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Databricks label/url when API returns Databricks default link", async () => {
    mockedFetchWorkspaceExternalLinks.mockResolvedValue({
      workspace_id: "ws-1",
      datasource_type: "databricks",
      links: [
        {
          key: "databricks_sql",
          label: "Databricks",
          url: "https://dbc.example.com/sql/warehouses/123",
          provider: "databricks",
          is_default: true,
        },
      ],
    });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("external-label").textContent).toBe("Databricks");
      expect(screen.getByTestId("external-url").textContent).toBe("https://dbc.example.com/sql/warehouses/123");
      expect(screen.getByTestId("external-disabled").textContent).toBe("false");
    });
  });

  it("renders Snowflake label/url when API returns Snowflake default link", async () => {
    mockedFetchWorkspaceExternalLinks.mockResolvedValue({
      workspace_id: "ws-1",
      datasource_type: "snowflake",
      links: [
        {
          key: "snowflake_console",
          label: "Snowflake",
          url: "https://xy12345.snowflakecomputing.com",
          provider: "snowflake",
          is_default: true,
        },
      ],
    });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("external-label").textContent).toBe("Snowflake");
      expect(screen.getByTestId("external-url").textContent).toBe("https://xy12345.snowflakecomputing.com");
    });
  });

  it("renders disabled External Console when links are empty", async () => {
    mockedFetchWorkspaceExternalLinks.mockResolvedValue({
      workspace_id: "ws-1",
      datasource_type: null,
      links: [],
    });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("external-label").textContent).toBe("External Console");
      expect(screen.getByTestId("external-disabled").textContent).toBe("true");
    });
  });

  it("reloads external links when workspace selection changes", async () => {
    mockedFetchWorkspaceExternalLinks.mockImplementation(async (workspaceId: string) => {
      if (workspaceId === "ws-1") {
        return {
          workspace_id: "ws-1",
          datasource_type: "databricks",
          links: [
            {
              key: "databricks_sql",
              label: "Databricks",
              url: "https://dbc.example.com/sql/warehouses/123",
              provider: "databricks",
              is_default: true,
            },
          ],
        };
      }
      return {
        workspace_id: "ws-2",
        datasource_type: "snowflake",
        links: [
          {
            key: "snowflake_console",
            label: "Snowflake",
            url: "https://xy12345.snowflakecomputing.com",
            provider: "snowflake",
            is_default: true,
          },
        ],
      };
    });

    const { store } = renderProbe();

    await waitFor(() => {
      expect(mockedFetchWorkspaceExternalLinks).toHaveBeenCalledWith("ws-1");
      expect(screen.getByTestId("external-label").textContent).toBe("Databricks");
    });

    act(() => {
      store.dispatch(setSelectedWorkspace("ws-2"));
    });

    await waitFor(() => {
      expect(mockedFetchWorkspaceExternalLinks).toHaveBeenCalledWith("ws-2");
      expect(screen.getByTestId("external-label").textContent).toBe("Snowflake");
    });
  });

  it("renders external links with new-tab safe attributes", async () => {
    renderSubmenu();

    const link = await screen.findByRole("link", { name: /databricks/i });
    expect(link).toHaveAttribute("href", "https://dbc.example.com/sql/warehouses/123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
