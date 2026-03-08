import type { DomainOverviewStats, StudioDomainDetails, StudioDomainSummary } from "../model/analysisTypes";

type DomainSummaryCardProps = {
  domain: StudioDomainSummary | StudioDomainDetails;
  stats: DomainOverviewStats;
};

export function DomainSummaryCard(props: DomainSummaryCardProps) {
  const { domain, stats } = props;

  return (
    <div className="analysisDomainSummary">
      <div className="analysisDomainSummary__header">
        <div className="analysisSelectionPill">{domain.label}</div>
      </div>
      <p className="analysisHint">{domain.description}</p>

      <div className="analysisDomainSummary__stats">
        <div>
          <strong>{stats.categoryCount}</strong>
          <span>Categories</span>
        </div>
        <div>
          <strong>{stats.fieldCount}</strong>
          <span>Fields</span>
        </div>
        <div>
          <strong>{stats.metricCount}</strong>
          <span>Metrics</span>
        </div>
      </div>

      {"exampleQuestions" in domain && Array.isArray(domain.exampleQuestions) && domain.exampleQuestions.length > 0 ? (
        <div className="analysisDomainSummary__examples">
          <h4>Example Questions</h4>
          <ul>
            {domain.exampleQuestions.slice(0, 3).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
