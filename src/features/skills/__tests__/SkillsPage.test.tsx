import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { createAppStore } from "@/app/core/store";

import SkillsPage from "../pages/SkillsPage";

const { hydrateQueryTreeMock } = vi.hoisted(() => ({
  hydrateQueryTreeMock: vi.fn(),
}));

vi.mock("@/shared/services/queryTreeApi", () => ({
  hydrateQueryTree: hydrateQueryTreeMock,
}));

vi.mock("../hooks", () => ({
  useCreateSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExecuteSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePatchSkillStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSkillRuns: () => ({ data: [], isLoading: false }),
  useSkills: () => ({
    data: { rows: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useSkillTemplates: () => [],
  useUpdateSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../components/SkillBuilderDrawer", () => ({
  default: () => null,
}));

vi.mock("../components/SkillsEmptyState", () => ({
  default: () => <div>Empty skills</div>,
}));

vi.mock("../components/SkillsList", () => ({
  default: () => <div>Skills list</div>,
}));

vi.mock("../components/SkillsPageHeader", () => ({
  default: () => <div>Skills header</div>,
}));

function renderPage() {
  const store = createAppStore({
    user: {
      user: {
        user_id: "user-1",
        effective_roles: [{ role_id: "r1", role_name: "workspace_admin" }],
      },
      rolesByFeature: { skills: ["admin", "user"] },
      capabilities: ["skills:admin", "skills:user"],
      loading: false,
      initialized: true,
      error: null,
    },
    userWorkspaces: {
      workspaces: [{ workspace_id: "ws-1", name: "Workspace 1", server: "-", is_default: 1 }],
      defaultWorkspace: {
        workspace_id: "ws-1",
        name: "Workspace 1",
        server: "-",
        is_default: 1,
      },
      selectedWorkspaceId: "ws-1",
      needsWorkspaceSelection: false,
      loaded: true,
      loading: false,
      error: null,
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SkillsPage />
      </QueryClientProvider>
    </Provider>,
  );
}

describe("SkillsPage", () => {
  beforeEach(() => {
    hydrateQueryTreeMock.mockResolvedValue({
      trees: {
        my: { rootNodes: [] },
        shared: { rootNodes: [] },
        library: { rootNodes: [] },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ destinations: [] }),
      }),
    );
  });

  it("shows destination creation controls for workspace admins", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Destinations" }));

    expect(
      await screen.findByRole("button", { name: /\+ Add destination/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Add first destination/i }),
    ).toBeInTheDocument();
  });
});
