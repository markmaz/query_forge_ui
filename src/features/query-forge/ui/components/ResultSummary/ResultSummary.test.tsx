import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ResultSummary } from "./ResultSummary";
import type { SummaryResult } from "../../hooks/useResultSummary";

const MOCK_SUMMARY: SummaryResult = {
  narrative: "Strong performance.",
  highlights: ["EMEA leads at 62%", "Revenue up 10%"],
  comparison: null,
  capped: false,
  totalRows: 50,
};

describe("ResultSummary", () => {
  // Loading
  it("renders loading skeleton while isLoading=true", () => {
    render(
      <ResultSummary
        summary={null}
        isLoading={true}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("result-summary-skeleton")).toBeInTheDocument();
  });

  // Highlights
  it("renders highlights as bullet list when present", () => {
    render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("EMEA leads at 62%")).toBeInTheDocument();
    expect(screen.getByText("Revenue up 10%")).toBeInTheDocument();
  });

  it("does not render bullet list when highlights is empty", () => {
    render(
      <ResultSummary
        summary={{ ...MOCK_SUMMARY, highlights: [] }}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  // Narrative
  it("renders narrative as prose when present", () => {
    render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Strong performance.")).toBeInTheDocument();
  });

  it("does not render narrative block when null", () => {
    render(
      <ResultSummary
        summary={{ ...MOCK_SUMMARY, narrative: null }}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    // No empty <p>
    const paragraphs = document.querySelectorAll("p");
    paragraphs.forEach((p) => expect(p.textContent).not.toBe(""));
  });

  it("does not render narrative block when empty string", () => {
    render(
      <ResultSummary
        summary={{ ...MOCK_SUMMARY, narrative: "" }}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("result-summary-narrative")).not.toBeInTheDocument();
  });

  // Capped
  it("renders capped disclaimer when capped=true", () => {
    render(
      <ResultSummary
        summary={{ ...MOCK_SUMMARY, capped: true, totalRows: 5000 }}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Summary based on first/)).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it("does not render capped disclaimer when capped=false", () => {
    render(
      <ResultSummary
        summary={{ ...MOCK_SUMMARY, capped: false }}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Summary based on first/)).not.toBeInTheDocument();
  });

  // Comparison
  it("renders comparison when non-null", () => {
    render(
      <ResultSummary
        summary={{ ...MOCK_SUMMARY, comparison: "Up 10% vs last week" }}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Up 10% vs last week/)).toBeInTheDocument();
  });

  it("does not render comparison block when null", () => {
    render(
      <ResultSummary
        summary={{ ...MOCK_SUMMARY, comparison: null }}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("result-summary-comparison")).not.toBeInTheDocument();
  });

  // Error
  it("renders error message and Retry button on isError=true", () => {
    render(
      <ResultSummary
        summary={null}
        isLoading={false}
        isError={true}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Summary unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("Retry button calls onRetry", () => {
    const onRetry = vi.fn();
    render(
      <ResultSummary
        summary={null}
        isLoading={false}
        isError={true}
        isVisible={true}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("Retry button not rendered when isVisible=false", () => {
    render(
      <ResultSummary
        summary={null}
        isLoading={false}
        isError={true}
        isVisible={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  // Collapse/expand
  it("section is expanded by default", () => {
    render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("result-summary-content")).toBeVisible();
  });

  it("chevron collapses/expands content on click", () => {
    render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    const toggle = screen.getByTestId("result-summary-toggle");
    fireEvent.click(toggle);
    expect(screen.getByTestId("result-summary-content")).not.toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByTestId("result-summary-content")).toBeVisible();
  });

  // Visibility
  it("isVisible=false applies display:none to container, component remains mounted", () => {
    render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={false}
        onRetry={vi.fn()}
      />,
    );
    const container = screen.getByTestId("result-summary-container");
    expect(container).toHaveStyle({ display: "none" });
    // Component is mounted — narrative text is in the DOM
    expect(screen.getByText("Strong performance.")).toBeInTheDocument();
  });

  it("isVisible=true — container is visible", () => {
    render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    const container = screen.getByTestId("result-summary-container");
    expect(container).not.toHaveStyle({ display: "none" });
  });

  it("does not auto-reopen on retry — section stays collapsed after user collapses and retries", () => {
    const { rerender } = render(
      <ResultSummary
        summary={null}
        isLoading={false}
        isError={true}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    // Collapse it
    const toggle = screen.getByTestId("result-summary-toggle");
    fireEvent.click(toggle);
    expect(screen.getByTestId("result-summary-content")).not.toBeVisible();

    // Retry (same key — no new preview, no key change)
    rerender(
      <ResultSummary
        summary={null}
        isLoading={true}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    // Section should NOT reopen automatically
    expect(screen.getByTestId("result-summary-content")).not.toBeVisible();
  });

  it("resets to expanded when remounted (caller uses React key on new preview)", () => {
    // First mount — collapse it
    const { unmount } = render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    const toggle = screen.getByTestId("result-summary-toggle");
    fireEvent.click(toggle);
    expect(screen.getByTestId("result-summary-content")).not.toBeVisible();
    unmount();

    // Second mount (simulates key change — new preview) — should be expanded again
    render(
      <ResultSummary
        summary={MOCK_SUMMARY}
        isLoading={false}
        isError={false}
        isVisible={true}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("result-summary-content")).toBeVisible();
  });
});
