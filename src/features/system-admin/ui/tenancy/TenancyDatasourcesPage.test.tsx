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
  createMutate: vi.fn(),
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

    mocks.useCreateDatasource.mockReturnValue({ mutate: mocks.createMutate, isPending: false });
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
    mocks.createMutate.mockImplementation(
      (
        _vars: unknown,
        options?: { onSuccess?: (value: unknown) => void }
      ) => options?.onSuccess?.({})
    );
  });

  it("triggers datasource test action", async () => {
    const user = userEvent.setup();
    render(<TenancyDatasourcesPage />);

    await user.click(await screen.findByText("Warehouse"));
    await user.click(await screen.findByRole("button", { name: /test connection/i }));

    expect(mocks.testMutate).toHaveBeenCalledWith("ds-1", expect.any(Object));
  });

  it("submits snowflake rsa key config from the datasource drawer", async () => {
    const user = userEvent.setup();
    render(<TenancyDatasourcesPage />);

    await user.click(screen.getByRole("button", { name: /new datasource/i }));
    await user.type(screen.getByLabelText(/^Name$/i), "Snowflake RSA");
    await user.selectOptions(screen.getByLabelText(/^Type$/i), "snowflake");
    await user.type(screen.getByLabelText(/^Account$/i), "xy12345");
    await user.type(screen.getByLabelText(/^User$/i), "svc_query_forge");
    await user.type(screen.getByLabelText(/^Database$/i), "ANALYTICS");
    await user.selectOptions(screen.getByLabelText(/^Authentication$/i), "rsa_key");
    await user.type(
      screen.getByLabelText(/^Private Key PEM$/i),
      "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
    );
    await user.type(screen.getByLabelText(/^Private Key Passphrase$/i), "pass-1");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mocks.createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        payload: expect.objectContaining({
          name: "Snowflake RSA",
          type: "snowflake",
          config_json: expect.objectContaining({
            account: "xy12345",
            user: "svc_query_forge",
            database: "ANALYTICS",
            auth_method: "rsa_key",
            private_key_pem: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
            private_key_passphrase: "pass-1",
          }),
        }),
      }),
      expect.any(Object)
    );
  });

  it("submits databricks oauth config from the datasource drawer", async () => {
    const user = userEvent.setup();
    render(<TenancyDatasourcesPage />);

    await user.click(screen.getByRole("button", { name: /new datasource/i }));
    await user.type(screen.getByLabelText(/^Name$/i), "Databricks OAuth");
    await user.selectOptions(screen.getByLabelText(/^Type$/i), "databricks");
    await user.type(screen.getByLabelText(/^Host$/i), "https://adb-1.azuredatabricks.net");
    await user.type(screen.getByLabelText(/^HTTP Path$/i), "/sql/1.0/warehouses/w1");
    await user.selectOptions(
      screen.getByLabelText(/^Authentication$/i),
      "oauth_client_credentials"
    );
    await user.type(screen.getByLabelText(/^Client ID$/i), "client-1");
    await user.type(screen.getByLabelText(/^Client Secret$/i), "secret-1");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mocks.createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        payload: expect.objectContaining({
          name: "Databricks OAuth",
          type: "databricks",
          config_json: expect.objectContaining({
            host: "https://adb-1.azuredatabricks.net",
            http_path: "/sql/1.0/warehouses/w1",
            auth_method: "oauth_client_credentials",
            client_id: "client-1",
            client_secret: "secret-1",
          }),
        }),
      }),
      expect.any(Object)
    );
  });
});
