import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DomainProfileForm from "./DomainProfileForm";
import type { DomainProfile } from "@/features/system-admin/types";

const mocks = vi.hoisted(() => ({
  getDomainProfileMetrics: vi.fn(),
  getDomainProfileMetricColumns: vi.fn(),
  updateDomainProfileMetrics: vi.fn(),
  getDomainTimePolicy: vi.fn(),
  updateDomainTimePolicy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/system-admin/api", () => ({
  getDomainProfileMetrics: mocks.getDomainProfileMetrics,
  getDomainProfileMetricColumns: mocks.getDomainProfileMetricColumns,
  updateDomainProfileMetrics: mocks.updateDomainProfileMetrics,
  getDomainTimePolicy: mocks.getDomainTimePolicy,
  updateDomainTimePolicy: mocks.updateDomainTimePolicy,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

const PROFILE: DomainProfile = {
  id: 1,
  workspace_id: "ws-1",
  domain_id: 7,
  domain_name: "Sales Performance",
  summary: "summary",
  keywords: [],
  entities: [],
  metrics: [],
  attributes: [],
  synonyms: [],
  acronyms: [],
  notes: "Initial notes",
  embedding_text: "Existing embedding text",
  content_hash: null,
  embedding_model: null,
  embedded_at: null,
  created_at: null,
  updated_at: null,
};

function renderForm(onSave: (payload: unknown) => void = () => undefined) {
  return render(
    <DomainProfileForm
      profile={PROFILE}
      onSave={onSave}
      onCancel={() => undefined}
      busy={false}
    />,
  );
}

describe("DomainProfileForm metric config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDomainProfileMetrics.mockResolvedValue({
      domain_id: 7,
      domain_name: "Sales Performance",
      has_profile: true,
      can_edit: true,
      metrics: [
        {
          metric_key: "total_net_amount",
          label: "Total Net Amount",
          kind: "numeric",
          agg: "sum",
          column_key: "wt180.net_amount",
          sql_metric: null,
        },
      ],
    });
    mocks.updateDomainProfileMetrics.mockResolvedValue({
      domain_id: 7,
      domain_name: "Sales Performance",
      has_profile: true,
      can_edit: true,
      metrics: [
        {
          metric_key: "total_net_amount",
          label: "Total Net Amount",
          kind: "numeric",
          agg: "sum",
          column_key: "wt180.net_amount",
          sql_metric: null,
        },
      ],
    });
    mocks.getDomainProfileMetricColumns.mockResolvedValue([
      {
        column_key: "wt180.net_amount",
        workspace_table_id: 180,
        model_column_id: 1001,
        column_name: "net_amount",
        table_name: "orders",
        display_name: "orders.net_amount",
      },
      {
        column_key: "wt180.order_id",
        workspace_table_id: 180,
        model_column_id: 1002,
        column_name: "order_id",
        table_name: "orders",
        display_name: "orders.order_id",
      },
    ]);
    mocks.getDomainTimePolicy.mockResolvedValue({
      domain_id: 7,
      domain_name: "Sales Performance",
      has_policy: true,
      can_edit: true,
      policy: {
        calendar_mode: "calendar",
        fiscal_year_start_month: null,
        school_year_start_month: null,
        school_year_end_month: null,
        timezone: "UTC",
        week_start: "monday",
        default_time_concept_key: null,
        allow_relative_ranges: true,
        default_grain: "month",
        prefer_time_object_over_filter: true,
        strict_mode: false,
        relative_map: {},
        notes: null,
      },
    });
  });

  it("loads and renders profile metrics grid", async () => {
    renderForm();

    expect(mocks.getDomainProfileMetrics).toHaveBeenCalledWith(7);
    expect(mocks.getDomainProfileMetricColumns).toHaveBeenCalledWith(7);
    expect(await screen.findByDisplayValue("total_net_amount")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Total Net Amount")).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "orders.net_amount" }).length).toBeGreaterThan(0);
  });

  it("edits and saves metrics", async () => {
    const user = userEvent.setup();
    renderForm();

    const labelInput = await screen.findByDisplayValue("Total Net Amount");
    await user.clear(labelInput);
    await user.type(labelInput, "Total Net");
    await user.click(screen.getByRole("button", { name: /save metrics/i }));

    await waitFor(() => {
      expect(mocks.updateDomainProfileMetrics).toHaveBeenCalledWith(7, [
        expect.objectContaining({
          metric_key: "total_net_amount",
          label: "Total Net",
          kind: "numeric",
          agg: "sum",
          column_key: "wt180.net_amount",
          sql_metric: {
            fn: "sum",
            label: "Total Net",
            field: {
              modelColumnId: 1001,
              columnName: "net_amount",
              workspaceTableId: 180,
              exprId: null,
              alias: null,
            },
          },
        }),
      ]);
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Domain profile metric config saved.");
  });

  it("disables metric save when can_edit is false", async () => {
    mocks.getDomainProfileMetrics.mockResolvedValueOnce({
      domain_id: 7,
      domain_name: "Sales Performance",
      has_profile: true,
      can_edit: false,
      metrics: [],
    });
    renderForm();

    await screen.findByText(/metric configuration is read-only/i);
    expect(screen.getByRole("button", { name: /save metrics/i })).toBeDisabled();
  });

  it("shows validation errors and backend errors when save fails", async () => {
    const user = userEvent.setup();
    mocks.getDomainProfileMetrics.mockResolvedValueOnce({
      domain_id: 7,
      domain_name: "Sales Performance",
      has_profile: true,
      can_edit: true,
      metrics: [],
    });
    renderForm();

    await screen.findByText(/profile metric configuration/i);
    await user.click(screen.getByTestId("add-metric-row-btn"));
    await user.click(screen.getByTestId("save-metrics-btn"));

    expect(await screen.findByText(/metric_key is required/i)).toBeInTheDocument();
    expect(mocks.updateDomainProfileMetrics).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Metric config validation failed.");

    const metricKeyInput = screen.getByTestId("metric-key-0");
    const labelInput = screen.getByTestId("metric-label-0");
    const columnSelect = screen.getByTestId("metric-column-key-0");
    await user.type(metricKeyInput, "row_count");
    await user.type(labelInput, "Row Count");
    await user.selectOptions(columnSelect, "wt180.order_id");

    mocks.updateDomainProfileMetrics.mockRejectedValueOnce(new Error("save failed"));
    await user.click(screen.getByTestId("save-metrics-btn"));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
    expect(mocks.toastError).toHaveBeenCalledWith("save failed");
  });

  it("keeps focus while typing into a new metric key row", async () => {
    const user = userEvent.setup();
    mocks.getDomainProfileMetrics.mockResolvedValueOnce({
      domain_id: 7,
      domain_name: "Sales Performance",
      has_profile: true,
      can_edit: true,
      metrics: [],
    });
    renderForm();

    await screen.findByText(/profile metric configuration/i);
    await user.click(screen.getByTestId("add-metric-row-btn"));

    const metricKeyInput = screen.getByTestId("metric-key-0");
    await user.type(metricKeyInput, "student_count");

    expect(metricKeyInput).toHaveValue("student_count");
    expect(metricKeyInput).toHaveFocus();
  });

  it("omits stale embedding_text when saving profile changes without editing the embedding field", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderForm(onSave);

    const summaryInput = screen.getByDisplayValue("summary");
    await user.clear(summaryInput);
    await user.type(summaryInput, "Updated summary");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "Updated summary",
        notes: "Initial notes",
        embedding_text: undefined,
      }),
    );
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty("metrics");
  });

  it("submits embedding_text when the user explicitly edits it", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderForm(onSave);

    await user.click(screen.getByRole("button", { name: /embedding text/i }));
    const embeddingInput = screen.getByDisplayValue("Existing embedding text");
    await user.clear(embeddingInput);
    await user.type(embeddingInput, "Custom embedding text");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding_text: "Custom embedding text",
      }),
    );
  });
});
