import type { StudioDomainSummary } from "../model/analysisTypes";
import { groupDomainRows, isWorkflowDomain } from "@/shared/domain/domainPresentation";

type DomainSelectorProps = {
  domains: StudioDomainSummary[];
  selectedDomainId: number | null;
  loading?: boolean;
  error?: string | null;
  onSelectDomain: (domainId: number) => void;
};

export function DomainSelector(props: DomainSelectorProps) {
  const { domains, selectedDomainId, loading = false, error = null, onSelectDomain } = props;
  const groupedDomains = groupDomainRows(domains);

  return (
    <div className="analysisPanel__section">
      <div className="analysisPanel__sectionHeader">
        <h3>Domain</h3>
        <button type="button" className="analysisLinkBtn" disabled title="Coming soon">
          Browse domains
        </button>
      </div>

      <label className="analysisField">
        <span>Select a domain</span>
        <select
          value={selectedDomainId ?? ""}
          disabled={loading || domains.length === 0}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value > 0) onSelectDomain(value);
          }}
        >
          <option value="">
            {loading ? "Loading domains..." : domains.length > 0 ? "Select a domain" : "No domains available"}
          </option>
          {groupedDomains.map((group) => (
            <optgroup label={group.label} key={`studio-domain-group-${group.key}`}>
              {group.rows.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {isWorkflowDomain(domain) ? `Workflow - ${domain.label}` : domain.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {error ? <p className="analysisErrorText">{error}</p> : null}
    </div>
  );
}
