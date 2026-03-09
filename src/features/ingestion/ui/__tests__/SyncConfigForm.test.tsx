import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SyncConfigForm from "../components/SyncConfigForm";
import { server } from "../../../../qa/msw/server";

const DATASOURCES = [
  { name: "primary", type: "databricks" },
  { name: "analytics", type: "snowflake" },
  { name: "broken", type: "unsupported_type" },
];

const datasourcesPath = /^https?:\/\/[^/]+(?:\/api\/v1)?\/datasources\/?$/;
const workspaceTablesPath =
  /^https?:\/\/[^/]+(?:\/api\/v1)?\/domains\/workspace-tables\/?/;
const schemasPath = /^https?:\/\/[^/]+(?:\/api\/v1)?\/ingestion\/schemas\/?/;

const WORKSPACE_TABLE_ROWS = [
  {
    workspace_table_id: 10,
    model_table_id: 10,
    model_table_name: "asset_orders",
    full_name: "asset.orders",
    table_name: "orders",
    schema_name: "asset",
    catalog_name: "main",
    variant_code: null,
    is_qe: false,
    exists_in_dbx: true,
    last_seen_at: null,
  },
  {
    workspace_table_id: 11,
    model_table_id: 11,
    model_table_name: "asset_customers",
    full_name: "asset.customers",
    table_name: "customers",
    schema_name: "asset",
    catalog_name: "main",
    variant_code: null,
    is_qe: false,
    exists_in_dbx: true,
    last_seen_at: null,
  },
  {
    workspace_table_id: 12,
    model_table_id: 12,
    model_table_name: "analytics_sessions",
    full_name: "analytics.sessions",
    table_name: "sessions",
    schema_name: "analytics",
    catalog_name: "main",
    variant_code: null,
    is_qe: false,
    exists_in_dbx: true,
    last_seen_at: null,
  },
];

function mockDatasourceAndWorkspaceTables() {
  server.use(
    http.get(datasourcesPath, () => HttpResponse.json(DATASOURCES)),
    http.get(workspaceTablesPath, () =>
      HttpResponse.json({ rows: WORKSPACE_TABLE_ROWS }),
    ),
    http.get(schemasPath, () =>
      HttpResponse.json({ schemas: ["asset", "analytics", "raw"] }),
    ),
  );
}

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderForm = (
  props?: Partial<React.ComponentProps<typeof SyncConfigForm>>,
) => {
  const queryClient = makeQueryClient();
  const defaultProps = {
    onSubmit: vi.fn(),
    isSubmitting: false,
    activeJobId: null,
    ...props,
  };
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <SyncConfigForm {...defaultProps} />
      </QueryClientProvider>,
    ),
    onSubmit: defaultProps.onSubmit,
  };
};

describe("SyncConfigForm", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("shows schema required error when submitted without schema", async () => {
    mockDatasourceAndWorkspaceTables();

    const user = userEvent.setup();
    renderForm();

    // Wait for datasource to auto-select
    await screen.findByText("primary — databricks");

    await user.click(screen.getByRole("button", { name: /start sync/i }));

    expect(await screen.findByText("Schema is required.")).toBeInTheDocument();
  });

  it("calls onSubmit with correct payload when form is valid", async () => {
    mockDatasourceAndWorkspaceTables();

    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    // Wait for datasource to load and default selection to happen
    await screen.findByText("primary — databricks");
    await screen.findByRole("option", { name: "asset" });

    const schemaInput = screen.getByLabelText(/^schema$/i);
    await user.selectOptions(schemaInput, "asset");

    await user.click(screen.getByRole("button", { name: /start sync/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        datasource: "primary",
        catalog: null,
        schema: "asset",
        table_names: null,
        run_profiling: false,
        run_enrichment: false,
      });
    });
  });

  it("shows confirmation modal when activeJobId is set", async () => {
    mockDatasourceAndWorkspaceTables();

    const user = userEvent.setup();
    const { onSubmit } = renderForm({ activeJobId: "job-1" });

    // Wait for datasource to load
    await screen.findByText("primary — databricks");
    await screen.findByRole("option", { name: "asset" });

    const schemaInput = screen.getByLabelText(/^schema$/i);
    await user.selectOptions(schemaInput, "asset");

    await user.click(screen.getByRole("button", { name: /start sync/i }));

    expect(
      await screen.findByText(/a sync is already in progress/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it("submits selected tables when user checks rows", async () => {
    mockDatasourceAndWorkspaceTables();

    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await screen.findByText("primary — databricks");
    await screen.findByRole("option", { name: "asset" });
    await user.selectOptions(screen.getByLabelText(/^schema$/i), "asset");
    await user.click(screen.getByLabelText("Select orders"));
    await user.click(screen.getByRole("button", { name: /start sync/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        datasource: "primary",
        catalog: null,
        schema: "asset",
        table_names: ["orders"],
        run_profiling: false,
        run_enrichment: false,
      });
    });
  });
});
