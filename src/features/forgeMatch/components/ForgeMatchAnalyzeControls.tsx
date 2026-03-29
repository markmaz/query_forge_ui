import type { ForgeMatchAnalyzeRequest, ForgeMatchSessionRecord } from "../types";

type DomainOption = {
  id: number;
  name: string;
};

type Props = {
  session: ForgeMatchSessionRecord | null;
  analyzeRequest: ForgeMatchAnalyzeRequest;
  domainOptions: DomainOption[];
  disableAnalyze: boolean;
  isAnalyzing: boolean;
  onAnalyzeRequestChange: (next: ForgeMatchAnalyzeRequest) => void;
  onAnalyze: () => Promise<void>;
};

export default function ForgeMatchAnalyzeControls({
  session,
  analyzeRequest,
  domainOptions,
  disableAnalyze,
  isAnalyzing,
  onAnalyzeRequestChange,
  onAnalyze,
}: Props) {
  return (
    <section className="fm-card" aria-label="ForgeMatch analysis controls">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">3. Analyze</h2>
          <p className="fm-card-subtitle">
            {session
              ? `${session.uploaded_filename} · ${session.source_record_count} source fields ready for analysis`
              : "Upload a document first to enable analysis."}
          </p>
        </div>
      </div>

      <div className="row g-3 fm-analyze-grid">
        <div className="col-md-2">
          <div className="fm-analyze-field">
            <label className="form-label" htmlFor="forge-match-top-n">Top N</label>
            <input
              id="forge-match-top-n"
              type="number"
              min={3}
              max={20}
              className="form-control"
              value={analyzeRequest.top_n ?? 8}
              onChange={(event) => {
                const value = Number(event.target.value);
                onAnalyzeRequestChange({ ...analyzeRequest, top_n: Number.isFinite(value) ? value : 8 });
              }}
            />
          </div>
        </div>

        <div className="col-md-4">
          <div className="fm-analyze-field">
            <label className="form-label" htmlFor="forge-match-domain">Prefer Domain (optional)</label>
            <select
              id="forge-match-domain"
              className="form-select"
              value={analyzeRequest.domain_id ?? ""}
              onChange={(event) => {
                const nextDomain = event.target.value ? Number(event.target.value) : undefined;
                onAnalyzeRequestChange({ ...analyzeRequest, domain_id: nextDomain });
              }}
            >
              <option value="">Search all workspace columns</option>
              {domainOptions.map((domain) => (
                <option key={domain.id} value={domain.id}>{domain.name}</option>
              ))}
            </select>
            <div className="form-text fm-analyze-field-help">Search stays global. This only biases ranking toward the selected domain.</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="fm-analyze-field">
            <label className="form-label" htmlFor="forge-match-vertical">Vertical (optional)</label>
            <input
              id="forge-match-vertical"
              className="form-control"
              value={analyzeRequest.vertical_norm ?? ""}
              placeholder="education"
              onChange={(event) => {
                const value = event.target.value.trim().toLowerCase();
                onAnalyzeRequestChange({
                  ...analyzeRequest,
                  vertical_norm: value || undefined,
                });
              }}
            />
            <div className="form-text fm-analyze-field-help fm-analyze-field-help-empty" aria-hidden="true">
              Placeholder
            </div>
          </div>
        </div>

        <div className="col-md-3 fm-analyze-run-col">
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
    </section>
  );
}
