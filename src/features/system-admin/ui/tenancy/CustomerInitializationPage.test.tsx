import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import CustomerInitializationPage from "./CustomerInitializationPage";

const mocks = vi.hoisted(() => ({
  useCreateOrganization: vi.fn(),
  useCreateWorkspace: vi.fn(),
  useCreateDatasource: vi.fn(),
  useBindWorkspace: vi.fn(),
  useBootstrapTenancy: vi.fn(),
  createOrganizationMutateAsync: vi.fn(),
  createWorkspaceMutateAsync: vi.fn(),
  createDatasourceMutateAsync: vi.fn(),
  bindWorkspaceMutateAsync: vi.fn(),
  bootstrapMutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  useCreateOrganization: mocks.useCreateOrganization,
  useCreateWorkspace: mocks.useCreateWorkspace,
  useCreateDatasource: mocks.useCreateDatasource,
  useBindWorkspace: mocks.useBindWorkspace,
  useBootstrapTenancy: mocks.useBootstrapTenancy,
}));

vi.mock("@/features/system-admin/api", () => ({
  parseConfigJsonInput: (value: string) => {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("config_json must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  },
  createWorkspaceLLM: vi.fn().mockResolvedValue({}),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

function renderPage() {
  const store = createAppStore({
    auth: { isAuthenticated: true, bootstrapped: true },
    user: {
      user: { user_id: "admin-1" },
      rolesByProduct: { semantic: ["admin"] },
      capabilities: ["semantic:admin"],
      loading: false,
      initialized: true,
      error: null,
    },
    userWorkspaces: {
      selectedWorkspaceId: "ws-777",
      workspaces: [],
      defaultWorkspace: null,
      loaded: true,
      loading: false,
      error: null,
    },
  } as any);

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <CustomerInitializationPage />
      </MemoryRouter>
    </Provider>,
  );
}

describe("CustomerInitializationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createOrganizationMutateAsync.mockResolvedValue({
      organization_id: "org-1",
      name: "Acme District",
      slug: "acme-district",
      description: null,
      is_active: true,
      created_at: null,
      updated_at: null,
    });
    mocks.createWorkspaceMutateAsync.mockResolvedValue({
      workspace_id: "ws-1",
      workspace_name: "Acme Workspace",
      organization_id: "org-1",
      organization_name: "Acme District",
      datasource_id: null,
      datasource_name: null,
      datasource_type: null,
      workspace_is_active: true,
      description: null,
      default_catalog: null,
      default_schema: null,
    });
    mocks.createDatasourceMutateAsync.mockResolvedValue({
      datasource_id: "ds-1",
      organization_id: "org-1",
      name: "Acme Snowflake",
      slug: "acme-snowflake",
      type: "snowflake",
      description: null,
      is_active: true,
      secret_ref: null,
      config_json: {},
      last_test_status: null,
      last_test_time: null,
      last_test_latency_ms: null,
      last_test_message: null,
      created_at: null,
      updated_at: null,
    });
    mocks.bindWorkspaceMutateAsync.mockResolvedValue({
      workspace_id: "ws-1",
      workspace_name: "Acme Workspace",
      organization_id: "org-1",
      organization_name: "Acme District",
      datasource_id: "ds-1",
      datasource_name: "Acme Snowflake",
      datasource_type: "snowflake",
      workspace_is_active: true,
      description: null,
      default_catalog: null,
      default_schema: null,
    });
    mocks.bootstrapMutateAsync.mockResolvedValue({
      workspace_id: "ws-legacy",
      organization: { id: "org-legacy" },
      datasource: { id: "ds-legacy" },
      workspace_binding: {},
      memberships: {},
    });

    mocks.useCreateOrganization.mockReturnValue({
      mutateAsync: mocks.createOrganizationMutateAsync,
      isPending: false,
    });
    mocks.useCreateWorkspace.mockReturnValue({
      mutateAsync: mocks.createWorkspaceMutateAsync,
      isPending: false,
    });
    mocks.useCreateDatasource.mockReturnValue({
      mutateAsync: mocks.createDatasourceMutateAsync,
      isPending: false,
    });
    mocks.useBindWorkspace.mockReturnValue({
      mutateAsync: mocks.bindWorkspaceMutateAsync,
      isPending: false,
    });
    mocks.useBootstrapTenancy.mockReturnValue({
      mutateAsync: mocks.bootstrapMutateAsync,
      isPending: false,
    });
  });

  it("runs org -> workspace -> datasource -> bind happy path", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText(/Organization Name/i),
      "Acme District",
    );
    await user.click(
      screen.getByRole("button", { name: /Create Organization/i }),
    );

    await screen.findByText(/Step 2: Workspace/i);
    await user.clear(screen.getByLabelText(/Workspace Name/i));
    await user.type(screen.getByLabelText(/Workspace Name/i), "Acme Workspace");
    await user.click(screen.getByRole("button", { name: /Create Workspace/i }));

    await screen.findByText(/Step 3: Datasource/i);
    await user.type(
      screen.getByLabelText(/Datasource Name/i),
      "Acme Snowflake",
    );
    await user.click(
      screen.getByRole("button", { name: /Create Datasource/i }),
    );

    await screen.findByText(/Step 4: Configure LLMs/i);
    await user.click(screen.getByRole("button", { name: /^Skip$/i }));

    await screen.findByText(/Step 5: Bind \+ Confirm/i);
    await user.click(screen.getByRole("button", { name: /^Bind Workspace$/i }));

    await waitFor(() => {
      expect(mocks.createOrganizationMutateAsync).toHaveBeenCalledTimes(1);
      expect(mocks.createWorkspaceMutateAsync).toHaveBeenCalledTimes(1);
      expect(mocks.createDatasourceMutateAsync).toHaveBeenCalledTimes(1);
      expect(mocks.bindWorkspaceMutateAsync).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        payload: { datasource_id: "ds-1" },
      });
    });

    expect(await screen.findByText(/Onboarding complete/i)).toBeInTheDocument();
  });

  it("stays on datasource step when datasource creation fails", async () => {
    mocks.createDatasourceMutateAsync.mockRejectedValueOnce(
      new Error("Datasource create failed"),
    );

    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText(/Organization Name/i),
      "Acme District",
    );
    await user.click(
      screen.getByRole("button", { name: /Create Organization/i }),
    );
    await screen.findByText(/Step 2: Workspace/i);

    await user.clear(screen.getByLabelText(/Workspace Name/i));
    await user.type(screen.getByLabelText(/Workspace Name/i), "Acme Workspace");
    await user.click(screen.getByRole("button", { name: /Create Workspace/i }));
    await screen.findByText(/Step 3: Datasource/i);

    await user.type(
      screen.getByLabelText(/Datasource Name/i),
      "Acme Snowflake",
    );
    await user.click(
      screen.getByRole("button", { name: /Create Datasource/i }),
    );

    expect(await screen.findByText(/Step 3: Datasource/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Step 5: Bind \+ Confirm/i),
    ).not.toBeInTheDocument();
    expect(mocks.bindWorkspaceMutateAsync).not.toHaveBeenCalled();
  });

  it("shows binding retry state on step 5 when bind fails", async () => {
    mocks.bindWorkspaceMutateAsync.mockRejectedValueOnce(
      new Error("binding failed"),
    );

    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText(/Organization Name/i),
      "Acme District",
    );
    await user.click(
      screen.getByRole("button", { name: /Create Organization/i }),
    );
    await screen.findByText(/Step 2: Workspace/i);

    await user.clear(screen.getByLabelText(/Workspace Name/i));
    await user.type(screen.getByLabelText(/Workspace Name/i), "Acme Workspace");
    await user.click(screen.getByRole("button", { name: /Create Workspace/i }));
    await screen.findByText(/Step 3: Datasource/i);

    await user.type(
      screen.getByLabelText(/Datasource Name/i),
      "Acme Snowflake",
    );
    await user.click(
      screen.getByRole("button", { name: /Create Datasource/i }),
    );
    await screen.findByText(/Step 4: Configure LLMs/i);
    await user.click(screen.getByRole("button", { name: /^Skip$/i }));
    await screen.findByText(/Step 5: Bind \+ Confirm/i);

    await user.click(screen.getByRole("button", { name: /^Bind Workspace$/i }));

    expect(await screen.findByText(/binding failed/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Bind Workspace$/i }),
    ).toBeInTheDocument();
  });
});
