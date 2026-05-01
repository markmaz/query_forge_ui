import type {
  FeedbackLearningCandidateFilters,
  FeedbackLearningGovernanceStatus,
  FeedbackLearningRiskLevel,
  FeedbackLearningTargetType,
} from "../../model/types";

type Props = {
  filters: FeedbackLearningCandidateFilters;
  onChange: (next: FeedbackLearningCandidateFilters) => void;
  onReset: () => void;
};

const STATUS_OPTIONS: Array<FeedbackLearningGovernanceStatus | ""> = [
  "",
  "pending",
  "needs_review",
  "approved",
  "rejected",
  "auto_applied",
];

const RISK_OPTIONS: Array<FeedbackLearningRiskLevel | ""> = ["", "low", "medium", "high"];
const TARGET_OPTIONS: Array<FeedbackLearningTargetType | ""> = [
  "",
  "semantic_override",
  "domain_override",
  "planner_rule",
  "manual_review",
];
const PAGE_SIZES = [25, 50, 100, 200] as const;

export function CandidateFilters({ filters, onChange, onReset }: Props) {
  return (
    <div className="sa-toolbar">
      <label className="sa-field" style={{ marginBottom: 0 }}>
        <span>Status</span>
        <select
          className="form-select form-select-sm"
          aria-label="Candidate status"
          value={filters.governance_status ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              governance_status:
                (event.target.value || undefined) as FeedbackLearningGovernanceStatus | undefined,
              page: 1,
            })
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? option.replaceAll("_", " ") : "All"}
            </option>
          ))}
        </select>
      </label>

      <label className="sa-field" style={{ marginBottom: 0 }}>
        <span>Risk</span>
        <select
          className="form-select form-select-sm"
          aria-label="Candidate risk"
          value={filters.risk_level ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              risk_level: (event.target.value || undefined) as FeedbackLearningRiskLevel | undefined,
              page: 1,
            })
          }
        >
          {RISK_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "All"}
            </option>
          ))}
        </select>
      </label>

      <label className="sa-field" style={{ marginBottom: 0 }}>
        <span>Target</span>
        <select
          className="form-select form-select-sm"
          aria-label="Candidate target"
          value={filters.target_type ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              target_type: (event.target.value || undefined) as FeedbackLearningTargetType | undefined,
              page: 1,
            })
          }
        >
          {TARGET_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? option.replaceAll("_", " ") : "All"}
            </option>
          ))}
        </select>
      </label>

      <label className="sa-field" style={{ marginBottom: 0 }}>
        <span>Change Type</span>
        <input
          className="form-control form-control-sm"
          aria-label="Change type"
          value={filters.change_type ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              change_type: event.target.value || undefined,
              page: 1,
            })
          }
          placeholder="add_alias"
        />
      </label>

      <label className="sa-field" style={{ marginBottom: 0 }}>
        <span>Concept Key</span>
        <input
          className="form-control form-control-sm"
          aria-label="Concept key"
          value={filters.concept_key ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              concept_key: event.target.value || undefined,
              page: 1,
            })
          }
          placeholder="student_name"
        />
      </label>

      <label className="sa-field" style={{ marginBottom: 0 }}>
        <span>Domain Key</span>
        <input
          className="form-control form-control-sm"
          aria-label="Domain key"
          value={filters.domain_key ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              domain_key: event.target.value || undefined,
              page: 1,
            })
          }
          placeholder="attendance"
        />
      </label>

      <label className="sa-field" style={{ marginBottom: 0 }}>
        <span>Page Size</span>
        <select
          className="form-select form-select-sm"
          aria-label="Candidate page size"
          value={filters.page_size ?? 50}
          onChange={(event) =>
            onChange({
              ...filters,
              page_size: Number(event.target.value),
              page: 1,
            })
          }
        >
          {PAGE_SIZES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="btn btn-sm btn-light" onClick={onReset}>
        Clear Filters
      </button>
    </div>
  );
}
