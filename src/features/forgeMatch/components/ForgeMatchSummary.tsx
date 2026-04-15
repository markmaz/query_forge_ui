import type {
  ForgeMatchAnalyzeRequest,
  ForgeMatchDraftResponse,
  ForgeMatchSessionRecord,
  ForgeMatchSummary,
} from "../types";

type DomainOption = {
  id: number;
  name: string;
};

type Props = {
  session: ForgeMatchSessionRecord | null;
  summary: ForgeMatchSummary | null;
  analyzeRequest: ForgeMatchAnalyzeRequest;
  domainOptions: DomainOption[];
  disableAnalyze: boolean;
  disableActions: boolean;
  isAnalyzing: boolean;
  onAnalyzeRequestChange: (next: ForgeMatchAnalyzeRequest) => void;
  onAnalyze: () => Promise<void>;
  onExport: (format: "csv" | "xlsx") => Promise<void>;
  onCreateDraft: (kind: "view_draft" | "domain_draft") => Promise<void>;
  onPrint: () => void;
  draftResponse: ForgeMatchDraftResponse | null;
};

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="fm-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ForgeMatchSummary({
  session,
  summary,
  analyzeRequest,
  domainOptions,
  disableAnalyze,
  disableActions,
  isAnalyzing,
  onAnalyzeRequestChange,
  onAnalyze,
  onExport,
  onCreateDraft,
  onPrint,
  draftResponse,
}: Props) {
  const statusCounts = summary?.status_counts ?? {};
  const decisionCounts = summary?.decision_counts ?? {};
  const confidenceBands = summary?.confidence_bands ?? {};

  return (
    <section className="fm-card" aria-label="ForgeMatch analyze controls">
      <div className="fm-summary-header">
        <div>
          <h2 className="fm-card-title">2. Analyze and Review</h2>
          <p className="fm-card-subtitle">
            {session
              ? `${session.uploaded_filename} · ${session.source_record_count} source fields · status ${session.status}`
              : "Upload a file to begin analysis."}
          </p>
        </div>
      </div>

      <div className="row g-3 align-items-end mb-3">
        <div className="col-md-2">
          <label className="form-label" htmlFor="forge-match-top-n">Top N</label>
          <input
            id="forge-match-top-n"
            type="number"
            min={3}
            max={20}
            className="form-control"
            value={analyzeRequest.top_n ?? 8}
            onChange={(event) => {
              const n = Number(event.target.value);
              onAnalyzeRequestChange({ ...analyzeRequest, top_n: Number.isFinite(n) ? n : 8 });
            }}
          />
        </div>

        <div className="col-md-4">
          <label className="form-label" htmlFor="forge-match-domain">Prefer Domain (optional)</label>
          <select
            id="forge-match-domain"
            className="form-select"
            value={analyzeRequest.domain_id ?? ""}
            onChange={(event) => {
              const next = event.target.value ? Number(event.target.value) : undefined;
              onAnalyzeRequestChange({ ...analyzeRequest, domain_id: next });
            }}
          >
            <option value="">Search all workspace columns</option>
            {domainOptions.map((domain) => (
              <option key={domain.id} value={domain.id}>{domain.name}</option>
            ))}
          </select>
          <div className="form-text">Search stays global. This only biases ranking toward the selected domain.</div>
        </div>

        <div className="col-md-3 d-flex flex-column gap-2">
          <div className="form-check form-switch">
            <input
              id="forge-match-force"
              className="form-check-input"
              type="checkbox"
              checked={Boolean(analyzeRequest.force)}
              onChange={(event) => onAnalyzeRequestChange({ ...analyzeRequest, force: event.target.checked })}
            />
            <label className="form-check-label" htmlFor="forge-match-force">Force re-analyze</label>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={disableAnalyze || isAnalyzing}
            onClick={() => void onAnalyze()}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Session"}
          </button>
        </div>
      </div>

      <div className="fm-summary-actions mb-3">
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={() => void onExport("csv")}>Export CSV</button>
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={() => void onExport("xlsx")}>Export XLSX</button>
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={onPrint}>Print</button>
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={() => void onCreateDraft("view_draft")}>Create View Draft</button>
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={() => void onCreateDraft("domain_draft")}>Create Domain Draft</button>
      </div>

      <div className="fm-metrics-grid">
        <MetricCard label="Total" value={summary?.total ?? 0} />
        <MetricCard label="Suggested" value={statusCounts.suggested ?? 0} />
        <MetricCard label="Accepted" value={statusCounts.accepted ?? 0} />
        <MetricCard label="Rejected" value={statusCounts.rejected ?? 0} />
        <MetricCard label="Needs Review" value={statusCounts.needs_review ?? 0} />
        <MetricCard label="Manual" value={statusCounts.manually_mapped ?? 0} />
        <MetricCard label="Matched" value={decisionCounts.matched ?? 0} />
        <MetricCard label="Ambiguous" value={decisionCounts.ambiguous ?? 0} />
        <MetricCard label="No Confident Match" value={decisionCounts.no_confident_match ?? 0} />
        <MetricCard label="High" value={confidenceBands.high ?? 0} />
        <MetricCard label="Medium" value={confidenceBands.medium ?? 0} />
        <MetricCard label="Low" value={confidenceBands.low ?? 0} />
      </div>

      {draftResponse ? (
        <div className="alert alert-info mt-3 mb-0" role="status">
          Draft artifact created: <strong>{draftResponse.artifact_id}</strong> ({draftResponse.accepted_column_count} accepted columns)
        </div>
      ) : null}
    </section>
  );
}
