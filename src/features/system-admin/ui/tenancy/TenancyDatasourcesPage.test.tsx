import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TenancyDatasourcesPage from "./TenancyDatasourcesPage";

const mocks = vi.hoisted(() => ({
  useOrganizations: vi.fn(),
  useOrganizationDatasources: vi.fn(),
  useCreateDatasource: vi.fn(),
  useUpdateDatasource: vi.fn(),
  useDeleteDatasource: vi.fn(),
  useTestDatasource: vi.fn(),
  testMutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  useOrganizations: mocks.useOrganizations,
  useOrganizationDatasources: mocks.useOrganizationDatasources,
  useCreateDatasource: mocks.useCreateDatasource,
  useUpdateDatasource: mocks.useUpdateDatasource,
  useDeleteDatasource: mocks.useDeleteDatasource,
  useTestDatasource: mocks.useTestDatasource,
}));

vi.mock("@/features/system-admin/api", () => ({
  parseConfigJsonInput: (value: string) => JSON.parse(value),
  formatConfigJson: (value: Record<string, unknown> | null | undefined) => JSON.stringify(value ?? {}, null, 2),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

describe("TenancyDatasourcesPage", () => {
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
      isFetching: false,
      isError: false,
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
        total: 1,
        limit: 25,
        offset: 0,
      },
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mocks.useCreateDatasource.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useUpdateDatasource.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useDeleteDatasource.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useTestDatasource.mockReturnValue({
      mutate: mocks.testMutate,
      isPending: false,
    });

    mocks.testMutate.mockImplementation((_id: string, options?: { onSuccess?: (value: unknown) => void }) => {
      options?.onSuccess?.({
        status: "ok",
        success: true,
        latency_ms: 99,
        message: "connected",
        tested_at: "2026-03-10T12:00:00Z",
      });
    });
  });

  it("triggers datasource test action", async () => {
    const user = userEvent.setup();
    render(<TenancyDatasourcesPage />);

    await user.click(await screen.findByText("Warehouse"));
    await user.click(await screen.findByRole("button", { name: /test connection/i }));

    expect(mocks.testMutate).toHaveBeenCalledWith("ds-1", expect.any(Object));
  });
});
