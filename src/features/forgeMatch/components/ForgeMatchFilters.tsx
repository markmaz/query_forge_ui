import type { ForgeMatchReviewStatus } from "../types";
import type { FocusFilter } from "./ForgeMatchTriagePanel";

type Props = {
  statusFilter: ForgeMatchReviewStatus | "all";
  confidenceFilter: "all" | "high" | "medium" | "low";
  textFilter: string;
  domainFilter: string;
  domainOptions: string[];
  focusFilter: FocusFilter;
  resultCount: number;
  onStatusFilterChange: (value: ForgeMatchReviewStatus | "all") => void;
  onConfidenceFilterChange: (value: "all" | "high" | "medium" | "low") => void;
  onTextFilterChange: (value: string) => void;
  onDomainFilterChange: (value: string) => void;
  onFocusFilterChange: (value: FocusFilter) => void;
};

const QUICK_FILTERS: Array<{ key: FocusFilter; label: string }> = [
  { key: "ambiguous", label: "Ambiguous" },
  { key: "no_match", label: "No Match" },
  { key: "low_confidence", label: "Low Confidence" },
  { key: "accepted", label: "Accepted" },
  { key: "manual", label: "Manual" },
];

export default function ForgeMatchFilters({
  statusFilter,
  confidenceFilter,
  textFilter,
  domainFilter,
  domainOptions,
  focusFilter,
  resultCount,
  onStatusFilterChange,
  onConfidenceFilterChange,
  onTextFilterChange,
  onDomainFilterChange,
  onFocusFilterChange,
}: Props) {
  return (
    <section className="fm-card" aria-label="ForgeMatch filters">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">Filter and Triage</h2>
          <p className="fm-card-subtitle">Narrow the review queue by status, confidence, search text, and quick triage chips.</p>
        </div>
        <span className="fm-result-count">{resultCount.toLocaleString()} rows</span>
      </div>

      <div className="row g-3 align-items-end">
        <div className="col-md-3 col-lg-2">
          <label className="form-label" htmlFor="forge-match-status-filter">Status</label>
          <select
            id="forge-match-status-filter"
            className="form-select"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as ForgeMatchReviewStatus | "all")}
          >
            <option value="all">All</option>
            <option value="suggested">Suggested</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="needs_review">Needs Review</option>
            <option value="manually_mapped">Manually Mapped</option>
          </select>
        </div>

        <div className="col-md-3 col-lg-2">
          <label className="form-label" htmlFor="forge-match-confidence-filter">Confidence</label>
          <select
            id="forge-match-confidence-filter"
            className="form-select"
            value={confidenceFilter}
            onChange={(event) => onConfidenceFilterChange(event.target.value as "all" | "high" | "medium" | "low")}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="col-md-3 col-lg-3">
          <label className="form-label" htmlFor="forge-match-domain-filter">Domain / Table</label>
          <select
            id="forge-match-domain-filter"
            className="form-select"
            value={domainFilter}
            onChange={(event) => onDomainFilterChange(event.target.value)}
          >
            <option value="">All domains</option>
            {domainOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="col-md-12 col-lg-5">
          <label className="form-label" htmlFor="forge-match-text-filter">Search</label>
          <input
            id="forge-match-text-filter"
            className="form-control"
            value={textFilter}
            onChange={(event) => onTextFilterChange(event.target.value)}
            placeholder="Search source field, description, table, or column"
          />
        </div>
      </div>

      <div className="fm-quick-filter-row" role="group" aria-label="Quick filters">
        <button
          type="button"
          className={`fm-chip ${focusFilter === "all" ? "is-active" : ""}`}
          onClick={() => onFocusFilterChange("all")}
        >
          All
        </button>
        {QUICK_FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`fm-chip ${focusFilter === chip.key ? "is-active" : ""}`}
            onClick={() => onFocusFilterChange(chip.key)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}
