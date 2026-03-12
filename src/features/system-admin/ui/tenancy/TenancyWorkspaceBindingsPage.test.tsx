import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TenancyWorkspaceBindingsPage from "./TenancyWorkspaceBindingsPage";

const mocks = vi.hoisted(() => ({
  useOrganizations: vi.fn(),
  useWorkspaceBindings: vi.fn(),
  useWorkspaceBindingDetail: vi.fn(),
  useUpdateWorkspaceBinding: vi.fn(),
  useOrganizationDatasources: vi.fn(),
  useWorkspaceMemberships: vi.fn(),
  useCreateWorkspaceMembership: vi.fn(),
  useUpdateWorkspaceMembership: vi.fn(),
  useDeleteWorkspaceMembership: vi.fn(),
  updateBindingMutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  useOrganizations: mocks.useOrganizations,
  useWorkspaceBindings: mocks.useWorkspaceBindings,
  useWorkspaceBindingDetail: mocks.useWorkspaceBindingDetail,
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

    mocks.useWorkspaceMemberships.mockReturnValue({
      data: { rows: [] },
      isFetching: false,
      isError: false,
      error: null,
    });

    mocks.useCreateWorkspaceMembership.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useUpdateWorkspaceMembership.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useDeleteWorkspaceMembership.mockReturnValue({ mutate: vi.fn(), isPending: false });

    mocks.useUpdateWorkspaceBinding.mockReturnValue({
      mutate: mocks.updateBindingMutate,
      isPending: false,
    });

    mocks.updateBindingMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
  });

  it("patches selected workspace binding", async () => {
    const user = userEvent.setup();
    render(<TenancyWorkspaceBindingsPage />);

    await user.click(screen.getByText("ws-1"));
    await screen.findByRole("dialog", { name: /workspace binding ws-1/i });

    const schemaInput = screen.getByLabelText(/^default schema$/i);
    await user.clear(schemaInput);
    await user.type(schemaInput, "analytics_reporting");
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
});
