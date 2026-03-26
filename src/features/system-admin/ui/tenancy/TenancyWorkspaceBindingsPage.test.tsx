import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TenancyWorkspaceBindingsPage from "./TenancyWorkspaceBindingsPage";

const mocks = vi.hoisted(() => ({
  useOrganizations: vi.fn(),
  useWorkspaceBindings: vi.fn(),
  useWorkspaceBindingDetail: vi.fn(),
  useCreateWorkspace: vi.fn(),
  useDeleteWorkspace: vi.fn(),
  useDatasourceNamespaces: vi.fn(),
  useUpdateWorkspaceBinding: vi.fn(),
  useOrganizationDatasources: vi.fn(),
  useWorkspaceMemberships: vi.fn(),
  useCreateWorkspaceMembership: vi.fn(),
  useUpdateWorkspaceMembership: vi.fn(),
  useDeleteWorkspaceMembership: vi.fn(),
  createWorkspaceMutate: vi.fn(),
  deleteWorkspaceMutate: vi.fn(),
  updateBindingMutate: vi.fn(),
  createMembershipMutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetchUserInfo: vi.fn(),
  fetchUsers: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  useOrganizations: mocks.useOrganizations,
  useWorkspaceBindings: mocks.useWorkspaceBindings,
  useWorkspaceBindingDetail: mocks.useWorkspaceBindingDetail,
  useCreateWorkspace: mocks.useCreateWorkspace,
  useDeleteWorkspace: mocks.useDeleteWorkspace,
  useDatasourceNamespaces: mocks.useDatasourceNamespaces,
  useUpdateWorkspaceBinding: mocks.useUpdateWorkspaceBinding,
  useOrganizationDatasources: mocks.useOrganizationDatasources,
  useWorkspaceMemberships: mocks.useWorkspaceMemberships,
  useCreateWorkspaceMembership: mocks.useCreateWorkspaceMembership,
  useUpdateWorkspaceMembership: mocks.useUpdateWorkspaceMembership,
  useDeleteWorkspaceMembership: mocks.useDeleteWorkspaceMembership,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/shared/services/users", () => ({
  fetchUserInfo: mocks.fetchUserInfo,
  fetchUsers: mocks.fetchUsers,
}));

describe("TenancyWorkspaceBindingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useOrganizations.mockReturnValue({
      data: {
        rows: [
          {
            organization_id: "org-1",
            name: "Acme Health",
            slug: "acme-health",
            description: null,
            is_active: true,
            created_at: null,
            updated_at: null,
          },
        ],
      },
    });

    mocks.useWorkspaceBindings.mockReturnValue({
      data: {
        rows: [
          {
            workspace_id: "ws-1",
            workspace_name: "Workspace One",
            organization_id: "org-1",
            organization_name: "Acme Health",
            datasource_id: "ds-1",
            datasource_name: "Warehouse",
            datasource_type: "snowflake",
            workspace_is_active: true,
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      },
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mocks.useWorkspaceBindingDetail.mockReturnValue({
      data: {
        workspace_id: "ws-1",
        workspace_name: "Workspace One",
        organization_id: "org-1",
        organization_name: "Acme Health",
        datasource_id: "ds-1",
        datasource_name: "Warehouse",
        datasource_type: "snowflake",
        workspace_is_active: true,
        description: "Main workspace",
        default_catalog: "analytics",
        default_schema: "public",
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    mocks.useCreateWorkspace.mockReturnValue({
      mutate: mocks.createWorkspaceMutate,
      isPending: false,
    });
    mocks.useDeleteWorkspace.mockReturnValue({
      mutate: mocks.deleteWorkspaceMutate,
      isPending: false,
    });
    mocks.useOrganizationDatasources.mockReturnValue({
      data: {
        rows: [
          {
            datasource_id: "ds-1",
            organization_id: "org-1",
            name: "Warehouse",
            slug: "warehouse",
            type: "snowflake",
            description: null,
            is_active: true,
            secret_ref: null,
            config_json: {},
            last_test_status: "ok",
            last_test_time: null,
            last_test_latency_ms: null,
            last_test_message: null,
            created_at: null,
            updated_at: null,
          },
        ],
      },
    });
    mocks.useDatasourceNamespaces.mockReturnValue({
      data: {
        datasource_id: "ds-1",
        datasource_type: "snowflake",
        catalogs: ["analytics"],
        schemas: ["public", "analytics_reporting"],
        current_catalog: "analytics",
        current_schema: "public",
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    mocks.useWorkspaceMemberships.mockReturnValue({
      data: {
        rows: [
          {
            membership_id: "1",
            user_id: "user-123",
            role: "viewer",
            is_active: true,
            created_at: null,
            updated_at: null,
          },
        ],
      },
      isFetching: false,
      isError: false,
      error: null,
    });

    mocks.useCreateWorkspaceMembership.mockReturnValue({ mutate: mocks.createMembershipMutate, isPending: false });
    mocks.useUpdateWorkspaceMembership.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useDeleteWorkspaceMembership.mockReturnValue({ mutate: vi.fn(), isPending: false });

    mocks.useUpdateWorkspaceBinding.mockReturnValue({
      mutate: mocks.updateBindingMutate,
      isPending: false,
    });

    mocks.createWorkspaceMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.deleteWorkspaceMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.createMembershipMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.updateBindingMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.fetchUserInfo.mockResolvedValue({
      user_id: "user-123",
      user_name: "tjordan",
      display_name: "Taylor Jordan",
      first_name: "Taylor",
      last_name: "Jordan",
      email: "user@example.com",
      eula_accepted: true,
      last_log_in: null,
      status: "Active",
      tos_accepted: true,
      two_factor_preference: null,
      workspaces: [],
    });
    mocks.fetchUsers.mockResolvedValue({
      users: [
        {
          user_id: "user-999",
          email: "person@example.com",
          status: "Active",
          last_log_in: null,
          first_name: "Jamie",
          last_name: "Rivera",
        },
      ],
      next_cursor: null,
      prev_cursor: null,
    });
  });

  it("patches selected workspace binding", async () => {
    const user = userEvent.setup();
    render(<TenancyWorkspaceBindingsPage />);

    await user.click(screen.getByText("ws-1"));
    await screen.findByRole("dialog", { name: /workspace binding ws-1/i });

    const schemaInput = screen.getByLabelText(/^default schema$/i);
    await user.selectOptions(schemaInput, "analytics_reporting");
    await user.click(screen.getByRole("button", { name: /save binding/i }));

    await waitFor(() => {
      expect(mocks.updateBindingMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          payload: expect.objectContaining({ default_schema: "analytics_reporting" }),
        }),
        expect.any(Object)
      );
    });
  });

  it("creates a workspace from the create dialog", async () => {
    const user = userEvent.setup();
    render(<TenancyWorkspaceBindingsPage />);

    await user.click(screen.getByRole("button", { name: /new workspace/i }));
    await screen.findByRole("dialog", { name: /create workspace/i });

    await user.selectOptions(screen.getByLabelText(/^organization$/i), "org-1");
    await user.selectOptions(screen.getByLabelText(/^datasource$/i), "ds-1");
    await user.type(screen.getByLabelText(/^workspace name$/i), "Acme Secondary Workspace");
    await user.selectOptions(screen.getByLabelText(/^default catalog$/i), "analytics");
    await user.selectOptions(screen.getByLabelText(/^default schema$/i), "public");
    await user.click(screen.getByRole("button", { name: /^create workspace$/i }));

    expect(mocks.createWorkspaceMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        name: "Acme Secondary Workspace",
        default_catalog: "analytics",
        default_schema: "public",
        is_active: true,
      }),
      expect.any(Object)
    );
  });

  it("opens memberships in a drawer, shows the user name, and adds a membership", async () => {
    const user = userEvent.setup();
    render(<TenancyWorkspaceBindingsPage />);

    await user.click(screen.getByRole("button", { name: /open memberships for ws-1/i }));
    await screen.findByRole("dialog", { name: /workspace memberships ws-1/i });

    await screen.findByText("Taylor Jordan");
    await screen.findByRole("button", { name: /jamie rivera/i });
    await user.type(screen.getByLabelText(/membership role/i), "viewer");
    await user.click(screen.getByRole("button", { name: /jamie rivera/i }));

    expect(mocks.createMembershipMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        payload: expect.objectContaining({
          user_id: "user-999",
          role: "viewer",
          is_active: true,
        }),
      }),
      expect.any(Object)
    );
  });

  it("deletes a workspace from the table action", async () => {
    const user = userEvent.setup();
    render(<TenancyWorkspaceBindingsPage />);

    await user.click(screen.getByRole("button", { name: /delete workspace ws-1/i }));
    const dialog = await screen.findByRole("dialog", { name: /delete workspace/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(mocks.deleteWorkspaceMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        hard: false,
      }),
      expect.any(Object)
    );
  });
});
