import React from 'react';

export const PromptBar: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onDraft: () => void;
  getSuggestion: () => void;
  loading?: boolean;
}> = ({ value, onChange, onDraft, getSuggestion, loading }) => {
  return (
    <div>
      <label className="form-label fw-bold">Describe your cohort</label>

      <textarea
        className="form-control"
        rows={3}
        placeholder="e.g., Adults with type 2 diabetes and ≥2 outpatient visits in past 12 months; exclude gestational diabetes"
        value={value}
        onChange={e => onChange(e.target.value)}
      />

      <div className="d-flex justify-content-between align-items-center mt-2">
        <button className="btn btn-secondary" type="button" onClick={getSuggestion}>
          <i className="fa fa-question me-2" />
          Suggestion
        </button>

        <button
          className="btn btn-primary"
          type="button"
          onClick={onDraft}
          disabled={loading || !value.trim()}
        >
          <i className="fa fa-bolt me-2" />
          {loading ? "Generating…" : "Generate Filters"}
        </button>
      </div>
    </div>
  );
};
