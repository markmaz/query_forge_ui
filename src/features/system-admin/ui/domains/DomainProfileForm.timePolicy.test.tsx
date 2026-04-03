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
  domain_name: "Sales",
  summary: "summary",
  keywords: [],
  entities: [],
  metrics: [],
  attributes: [],
  synonyms: [],
  acronyms: [],
  notes: null,
  embedding_text: null,
  content_hash: null,
  embedding_model: null,
  embedded_at: null,
  created_at: null,
  updated_at: null,
};

function renderForm() {
  return render(
    <DomainProfileForm
      profile={PROFILE}
      onSave={() => undefined}
      onCancel={() => undefined}
      busy={false}
    />,
  );
}

describe("DomainProfileForm time policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDomainProfileMetrics.mockResolvedValue({
      domain_id: 7,
      domain_name: "Sales",
      has_profile: true,
      can_edit: true,
      metrics: [],
    });
    mocks.updateDomainProfileMetrics.mockResolvedValue({
      domain_id: 7,
      domain_name: "Sales",
      has_profile: true,
      can_edit: true,
      metrics: [],
    });
    mocks.getDomainProfileMetricColumns.mockResolvedValue([
      {
        column_key: "wt552.school_name",
        workspace_table_id: 552,
        model_column_id: 14649,
        column_name: "school_name",
        table_name: "dim_school",
        display_name: "dim_school.school_name",
      },
      {
        column_key: "wt593.school_year",
        workspace_table_id: 593,
        model_column_id: 15471,
        column_name: "school_year",
        table_name: "fct_student_school_association",
        display_name: "fct_student_school_association.school_year",
      },
    ]);
    mocks.getDomainTimePolicy.mockResolvedValue({
      domain_id: 7,
      domain_name: "Sales",
      has_policy: true,
      can_edit: true,
      policy: {
        calendar_mode: "calendar",
        fiscal_year_start_month: null,
        school_year_start_month: null,
        school_year_end_month: null,
        timezone: "UTC",
        week_start: "monday",
        default_time_concept_key: "wt593.school_year",
        allow_relative_ranges: true,
        default_grain: "month",
        prefer_time_object_over_filter: true,
        strict_mode: false,
        relative_map: {
          last_30_days: "P30D",
        },
        semester: {
          labels: {
            spring: "Spring",
            fall: "Fall",
            year_round: "Summer Session",
          },
          month_ranges: {
            spring: [1, 5],
            fall: [8, 12],
            year_round: [6, 7],
          },
          indicator_columns: {
            fall: "wt24.is_fall_term",
          },
        },
        notes: "Initial notes",
      },
    });
    mocks.updateDomainTimePolicy.mockResolvedValue({
      domain_id: 7,
      domain_name: "Sales",
      has_policy: true,
      can_edit: true,
      policy: {
        calendar_mode: "calendar",
        fiscal_year_start_month: null,
        school_year_start_month: null,
        school_year_end_month: null,
        timezone: "America/Chicago",
        week_start: "monday",
        default_time_concept_key: "wt593.school_year",
        allow_relative_ranges: true,
        default_grain: "month",
        prefer_time_object_over_filter: true,
        strict_mode: false,
        relative_map: {
          last_30_days: "P30D",
        },
        semester: {
          labels: {
            spring: "Spring",
            fall: "Fall",
            year_round: "Summer Session",
          },
          month_ranges: {
            spring: [1, 5],
            fall: [8, 12],
            year_round: [6, 7],
          },
          indicator_columns: {
            fall: "wt24.is_fall_term",
          },
        },
        notes: "Updated notes",
      },
    });
  });

  it("renders loaded time policy", async () => {
    renderForm();

    expect(mocks.getDomainTimePolicy).toHaveBeenCalledWith(7);
    expect(await screen.findByTestId("time-policy-timezone")).toHaveValue("UTC");
    expect(screen.getByTestId("time-policy-week-start")).toHaveValue("monday");
    expect(screen.getByLabelText(/default time column/i)).toHaveValue("wt593.school_year");
    expect(screen.getByTestId("time-policy-semester-label-year_round")).toHaveValue("Summer Session");
    expect(screen.getByTestId("time-policy-semester-indicator-fall")).toHaveValue("wt24.is_fall_term");
    expect(
      screen.getByRole("option", { name: "fct_student_school_association.school_year" }),
    ).toBeInTheDocument();
  });

  it("toggles fiscal field visibility from calendar mode", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByTestId("time-policy-calendar-mode");
    expect(screen.queryByTestId("time-policy-fiscal-month")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByTestId("time-policy-calendar-mode"), "fiscal");
    expect(screen.getByTestId("time-policy-fiscal-month")).toBeInTheDocument();
  });

  it("shows school-year month fields for school_year mode", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByTestId("time-policy-calendar-mode");
    await user.selectOptions(screen.getByTestId("time-policy-calendar-mode"), "school_year");
    expect(screen.getByTestId("time-policy-school-year-start-month")).toBeInTheDocument();
    expect(screen.getByTestId("time-policy-school-year-end-month")).toBeInTheDocument();
  });

  it("disables save when can_edit is false", async () => {
    mocks.getDomainTimePolicy.mockResolvedValueOnce({
      domain_id: 7,
      domain_name: "Sales",
      has_policy: true,
      can_edit: false,
      policy: {
        calendar_mode: "calendar",
        fiscal_year_start_month: null,
        school_year_start_month: null,
        school_year_end_month: null,
        timezone: "UTC",
        week_start: "monday",
        default_time_concept_key: null,
        allow_relative_ranges: true,
        default_grain: null,
        prefer_time_object_over_filter: true,
        strict_mode: false,
        relative_map: {},
        semester: {
          labels: {
            spring: "Spring",
            fall: "Fall",
            year_round: "Year Round",
          },
          month_ranges: {
            spring: [1, 5],
            fall: [8, 12],
            year_round: [6, 7],
          },
          indicator_columns: {},
        },
        notes: null,
      },
    });

    renderForm();

    await screen.findByText(/time policy is read-only/i);
    expect(screen.getByTestId("save-time-policy-btn")).toBeDisabled();
  });

  it("saves time policy and updates UI", async () => {
    const user = userEvent.setup();
    renderForm();

    const timezoneInput = (await screen.findByTestId("time-policy-timezone")) as HTMLInputElement;
    await user.clear(timezoneInput);
    await user.type(timezoneInput, "America/Chicago");
    await user.selectOptions(screen.getByLabelText(/default time column/i), "wt552.school_name");
    await user.clear(screen.getByTestId("time-policy-semester-label-year_round"));
    await user.type(screen.getByTestId("time-policy-semester-label-year_round"), "Summer");
    await user.clear(screen.getByTestId("time-policy-semester-indicator-spring"));
    await user.type(screen.getByTestId("time-policy-semester-indicator-spring"), "wt552.is_spring");

    await user.click(screen.getByTestId("save-time-policy-btn"));

    await waitFor(() => {
      expect(mocks.updateDomainTimePolicy).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          timezone: "America/Chicago",
          calendar_mode: "calendar",
          default_time_concept_key: "wt552.school_name",
          semester: expect.objectContaining({
            labels: expect.objectContaining({ year_round: "Summer" }),
            indicator_columns: expect.objectContaining({ spring: "wt552.is_spring" }),
          }),
        }),
      );
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Domain time policy saved.");
  });

  it("saves school-year time policy months", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByTestId("time-policy-calendar-mode");
    await user.selectOptions(screen.getByTestId("time-policy-calendar-mode"), "school_year");
    await user.clear(screen.getByTestId("time-policy-school-year-start-month"));
    await user.type(screen.getByTestId("time-policy-school-year-start-month"), "8");
    await user.clear(screen.getByTestId("time-policy-school-year-end-month"));
    await user.type(screen.getByTestId("time-policy-school-year-end-month"), "5");

    await user.click(screen.getByTestId("save-time-policy-btn"));

    await waitFor(() => {
      expect(mocks.updateDomainTimePolicy).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          calendar_mode: "school_year",
          school_year_start_month: 8,
          school_year_end_month: 5,
          fiscal_year_start_month: null,
          semester: expect.any(Object),
        }),
      );
    });
  });

  it("shows validation errors for bad fiscal month and relative map rows", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByTestId("time-policy-calendar-mode");
    await user.selectOptions(screen.getByTestId("time-policy-calendar-mode"), "fiscal");
    const fiscalMonth = screen.getByTestId("time-policy-fiscal-month");
    await user.clear(fiscalMonth);

    await user.click(screen.getByTestId("add-time-policy-relative-row-btn"));
    await user.click(screen.getByTestId("save-time-policy-btn"));

    expect(
      await screen.findByText(/Fiscal year start month must be an integer between 1 and 12/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Relative map row 2 requires non-empty key and value/i)).toBeInTheDocument();
    expect(mocks.updateDomainTimePolicy).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Time policy validation failed.");
  });

  it("shows validation errors for bad school-year months", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByTestId("time-policy-calendar-mode");
    await user.selectOptions(screen.getByTestId("time-policy-calendar-mode"), "school_year");
    await user.clear(screen.getByTestId("time-policy-school-year-start-month"));
    await user.clear(screen.getByTestId("time-policy-school-year-end-month"));
    await user.click(screen.getByTestId("save-time-policy-btn"));

    expect(
      await screen.findByText(/School year start month must be an integer between 1 and 12/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/School year end month must be an integer between 1 and 12/i),
    ).toBeInTheDocument();
    expect(mocks.updateDomainTimePolicy).not.toHaveBeenCalled();
  });

  it("shows validation errors for bad semester config", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByTestId("time-policy-calendar-mode");
    await user.clear(screen.getByTestId("time-policy-semester-label-spring"));
    await user.clear(screen.getByTestId("time-policy-semester-start-fall"));
    await user.clear(screen.getByTestId("time-policy-semester-indicator-year_round"));
    await user.type(screen.getByTestId("time-policy-semester-indicator-year_round"), "bad_column");
    await user.click(screen.getByTestId("save-time-policy-btn"));

    expect(await screen.findByText(/Spring semester label is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Fall semester start month must be an integer between 1 and 12/i)).toBeInTheDocument();
    expect(screen.getByText(/Year Round indicator column must match wt<number>\.\<column_name\>\./i)).toBeInTheDocument();
    expect(mocks.updateDomainTimePolicy).not.toHaveBeenCalled();
  });
});
