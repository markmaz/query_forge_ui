import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanExplanation } from "../PlanExplanation";

describe("PlanExplanation", () => {
  it("renders summary with confidence badge and collapsed details", () => {
    render(
      <PlanExplanation
        explanation={{
          summary: "This query focuses on enrollment trends by grade.",
          summary_source: "llm",
          domain: {
            selected_domain_name: "Enrollment",
            reason: "This domain contains current student roster facts.",
            selected_domain_id: 7,
          },
          dimensions: [
            {
              label: "Grade level",
              reason: "Needed to break out enrollment by grade.",
              column_key: "wt61.grade_level",
            },
          ],
          filters: [
            {
              label: "School year",
              op_label: "equals",
              value: 2026,
              reason: "Limits results to the active school year.",
              column_key: "wt61.school_year",
            },
          ],
          metrics: [
            {
              label: "Student count",
              reason: "Measures enrollment volume.",
              metric_ref: { type: "count_distinct", column_key: "wt61.k_student" },
            },
          ],
        }}
        confidence="high"
      />
    );

    expect(screen.getByText(/why this answer/i)).toBeInTheDocument();
    expect(screen.getByText(/this query focuses on enrollment trends by grade/i)).toBeInTheDocument();
    expect(screen.getByText(/^high$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see more/i })).toBeInTheDocument();
    expect(screen.queryByText(/domain chosen/i)).not.toBeInTheDocument();
    expect(screen.queryByText("wt61.grade_level")).not.toBeInTheDocument();
  });

  it("renders fallback summary when summary is missing", () => {
    render(
      <PlanExplanation
        explanation={{
          summary: null,
          summary_source: "deterministic",
          domain: {
            selected_domain_name: "Student Profile",
            reason: "The request asks for student identity attributes.",
          },
        }}
      />
    );

    expect(
      screen.getByText(/we built this query based on your request and available data/i)
    ).toBeInTheDocument();
  });

  it("hides panel when explanation is missing", () => {
    const { container } = render(<PlanExplanation explanation={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("formats filters for single value and values array", async () => {
    const user = userEvent.setup();
    render(
      <PlanExplanation
        explanation={{
          summary: "Applied requested filters.",
          summary_source: "llm",
          filters: [
            {
              label: "First name",
              op_label: "equals",
              value: "Holden",
              reason: "Matches the requested student.",
            },
            {
              label: "School",
              op_label: "in",
              values: ["Central High", "North High"],
              reason: "Restricts to selected schools.",
            },
          ],
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: /see more/i }));

    expect(screen.getByText(/first name equals holden/i)).toBeInTheDocument();
    expect(screen.getByText(/school in \(central high, north high\)/i)).toBeInTheDocument();
  });

  it("uses see less when expanded and renders technical details accordion", async () => {
    const user = userEvent.setup();
    render(
      <PlanExplanation
        explanation={{
          summary: "Summary",
          summary_source: "llm",
          domain: {
            selected_domain_name: "Enrollment",
            reason: "Reason",
            selected_domain_id: 7,
          },
          dimensions: [{ label: "Grade", column_key: "wt61.grade_level" }],
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: /see more/i }));
    expect(screen.getByRole("button", { name: /see less/i })).toBeInTheDocument();
    expect(screen.getByText(/technical details/i)).toBeInTheDocument();
  });
});
