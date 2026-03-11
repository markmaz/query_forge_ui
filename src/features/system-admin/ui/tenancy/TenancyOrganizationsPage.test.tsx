import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TenancyOrganizationsPage from "./TenancyOrganizationsPage";

const mocks = vi.hoisted(() => ({
  useOrganizations: vi.fn(),
  useCreateOrganization: vi.fn(),
  useUpdateOrganization: vi.fn(),
  useDeleteOrganization: vi.fn(),
  useOrganizationMemberships: vi.fn(),
  useCreateOrganizationMembership: vi.fn(),
  useUpdateOrganizationMembership: vi.fn(),
  useDeleteOrganizationMembership: vi.fn(),
  createOrgMutate: vi.fn(),
  updateOrgMutate: vi.fn(),
  deleteOrgMutate: vi.fn(),
  createMembershipMutate: vi.fn(),
  fetchUsers: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  useOrganizations: mocks.useOrganizations,
  useCreateOrganization: mocks.useCreateOrganization,
  useUpdateOrganization: mocks.useUpdateOrganization,
  useDeleteOrganization: mocks.useDeleteOrganization,
  useOrganizationMemberships: mocks.useOrganizationMemberships,
  useCreateOrganizationMembership: mocks.useCreateOrganizationMembership,
  useUpdateOrganizationMembership: mocks.useUpdateOrganizationMembership,
  useDeleteOrganizationMembership: mocks.useDeleteOrganizationMembership,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/shared/services/users", () => ({
  fetchUsers: mocks.fetchUsers,
}));

describe("TenancyOrganizationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useOrganizations.mockReturnValue({
      data: {
        rows: [
          {
            organization_id: "org-1",
            name: "Acme Health",
            slug: "acme-health",
            description: "Acme",
            is_active: true,
            created_at: null,
            updated_at: null,
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

    mocks.useCreateOrganization.mockReturnValue({
      mutate: mocks.createOrgMutate,
      isPending: false,
    });
    mocks.useUpdateOrganization.mockReturnValue({
      mutate: mocks.updateOrgMutate,
      isPending: false,
    });
    mocks.useDeleteOrganization.mockReturnValue({
      mutate: mocks.deleteOrgMutate,
      isPending: false,
    });

    mocks.useOrganizationMemberships.mockReturnValue({
      data: { rows: [] },
      isFetching: false,
      isError: false,
      error: null,
    });
    mocks.useCreateOrganizationMembership.mockReturnValue({ mutate: mocks.createMembershipMutate, isPending: false });
    mocks.useUpdateOrganizationMembership.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useDeleteOrganizationMembership.mockReturnValue({ mutate: vi.fn(), isPending: false });

    mocks.createOrgMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.updateOrgMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.deleteOrgMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.createMembershipMutate.mockImplementation((_payload: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mocks.fetchUsers.mockResolvedValue({
      users: [],
      next_cursor: null,
      prev_cursor: null,
    });
  });

  it("supports create, update, and delete actions", async () => {
    const user = userEvent.setup();
    render(<TenancyOrganizationsPage />);

    await user.click(screen.getByRole("button", { name: /new organization/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Summit Analytics");
    await user.type(screen.getByLabelText(/^slug$/i), "summit-analytics");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mocks.createOrgMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Summit Analytics",
        slug: expect.stringContaining("summit"),
      }),
      expect.any(Object)
    );

    await user.click(screen.getByText("Acme Health"));
    const nameInput = screen.getByLabelText(/^name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Acme Health Updated");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mocks.updateOrgMutate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      expect.any(Object)
    );

    await user.click(screen.getByRole("button", { name: /close organization drawer/i }));
    await user.click(screen.getByRole("button", { name: /delete organization acme health/i }));
    const deleteDialog = screen.getByRole("dialog", { name: /delete organization/i });
    await user.click(within(deleteDialog).getByRole("button", { name: /^delete$/i }));

    expect(mocks.deleteOrgMutate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", hard: false }),
      expect.any(Object)
    );
  });

  it("adds organization membership from the searchable user list", async () => {
    const user = userEvent.setup();
    mocks.fetchUsers.mockResolvedValue({
      users: [
        {
          user_id: "user-123",
          email: "user@example.com",
          status: "Active",
          last_log_in: null,
          first_name: "Taylor",
          last_name: "Jordan",
        },
      ],
      next_cursor: null,
      prev_cursor: null,
    });

    render(<TenancyOrganizationsPage />);

    await user.click(screen.getByText("Acme Health"));
    const addMemberButton = await screen.findByRole("button", { name: /taylor jordan/i });
    await user.click(addMemberButton);

    expect(mocks.createMembershipMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        payload: expect.objectContaining({
          user_id: "user-123",
          is_active: true,
        }),
      }),
      expect.any(Object)
    );
  });
});
