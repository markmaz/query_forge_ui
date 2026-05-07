import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

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

function QueryForgeProbe() {
  const menu = useNewMenuList();
  const queryForge = menu.find((item) => item.title === "Query Forge");
  const groups = queryForge?.Items ?? [];
  const groupTitles = groups.map((item) => item.title).join(" | ");
  const shapeGroup = groups.find((item) => item.title === "Shape");
  const buildGroup = groups.find((item) => item.title === "Build");
  const aiGroup = groups.find((item) => item.title === "AI");
  const automationGroup = groups.find((item) => item.title === "Automation");
  const flowForgeGroup = automationGroup?.menu?.find((item) => item.title === "FlowForge");
  const flowForgeAdminGroup = flowForgeGroup?.menu?.find((item) => item.title === "Admin");

  return (
    <div>
      <div data-testid="query-forge-groups">{groupTitles}</div>
      <div data-testid="build-children">{buildGroup?.menu?.map((item) => item.title).join(" | ") ?? ""}</div>
      <div data-testid="shape-children">{shapeGroup?.menu?.map((item) => item.title).join(" | ") ?? ""}</div>
      <div data-testid="ai-children">{aiGroup?.menu?.map((item) => item.title).join(" | ") ?? ""}</div>
      <div data-testid="automation-children">{automationGroup?.menu?.map((item) => item.title).join(" | ") ?? ""}</div>
      <div data-testid="flowforge-children">{flowForgeGroup?.menu?.map((item) => item.title).join(" | ") ?? ""}</div>
      <div data-testid="flowforge-admin-children">{flowForgeAdminGroup?.menu?.map((item) => item.title).join(" | ") ?? ""}</div>
    </div>
  );
}

describe("useNewMenuList Query Forge structure", () => {
  it("groups Query Forge links under Build, Shape, AI, and Automation", () => {
    canMutateMock = true;

    const store = createAppStore({
      auth: { isAuthenticated: true, bootstrapped: true },
      user: {
        user: { user_id: "admin-1" },
        rolesByFeature: {
          query_studio: ["admin"],
          catalog: ["admin"],
          forge_insights: ["user"],
          forge_match: ["user"],
          skills: ["user"],
          flowforge: ["admin"],
          semantic: ["admin"],
        },
        capabilities: [
          "query_studio:admin",
          "catalog:admin",
          "forge_insights:user",
          "forge_match:user",
          "skills:user",
          "flowforge:admin",
          "semantic:admin",
        ],
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
          <QueryForgeProbe />
        </QueryClientProvider>
      </Provider>,
    );

    expect(screen.getByTestId("query-forge-groups").textContent).toBe("Build | Shape | AI | Automation");
    expect(screen.getByTestId("build-children").textContent).toContain("Query Studio");
    expect(screen.getByTestId("build-children").textContent).toContain("Analysis Studio");
    expect(screen.getByTestId("shape-children").textContent).toBe("Domain Studio | Data Dictionary | Data Mappings");
    expect(screen.getByTestId("ai-children").textContent).toBe("Forge Insights | Forge Match");
    expect(screen.getByTestId("automation-children").textContent).toBe("Skills | FlowForge");
    expect(screen.getByTestId("flowforge-children").textContent).toBe(
      "Designer | Runs | Needs Attention | Reports | Data Movement | Admin",
    );
    expect(screen.getByTestId("flowforge-admin-children").textContent).toBe(
      "Integrations | Resources | Matching Policies | Templates | Settings",
    );
  });
});
