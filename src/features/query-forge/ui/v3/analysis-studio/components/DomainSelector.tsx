import type { StudioDomainSummary } from "../model/analysisTypes";

type DomainSelectorProps = {
  domains: StudioDomainSummary[];
  selectedDomainId: number | null;
  loading?: boolean;
  error?: string | null;
  onSelectDomain: (domainId: number) => void;
};

export function DomainSelector(props: DomainSelectorProps) {
  const { domains, selectedDomainId, loading = false, error = null, onSelectDomain } = props;

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
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {domain.label}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="analysisErrorText">{error}</p> : null}
    </div>
  );
}
