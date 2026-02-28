import React from "react";

import type { SpacyExtraction } from "../../../../shared/services/semantic";

type Props = {
  spacy?: SpacyExtraction | null;
  emptyText?: string;
};

const SLOT_LABELS: Array<{ key: keyof SpacyExtraction["slots"]; label: string }> = [
  { key: "metric", label: "Metric" },
  { key: "dimensions", label: "Dimensions" },
  { key: "subgroups", label: "Subgroups" },
  { key: "time_ranges", label: "Time Ranges" },
  { key: "org_schools", label: "Schools" },
  { key: "org_districts", label: "Districts" },
];

export function SpacyExtractionPanel({
  spacy,
  emptyText = "No spaCy extraction data for this response.",
}: Props) {
  if (!spacy) {
    return <div className="text-muted small">{emptyText}</div>;
  }

  const byLabelEntries = Object.entries(spacy.by_label ?? {});

  return (
    <div className="d-flex flex-column gap-3">
      <section>
        <h6 className="mb-1">Normalized Text</h6>
        <div className="small text-break">{spacy.normalized_text || "-"}</div>
      </section>

      <section>
        <h6 className="mb-2">Slots</h6>
        <div className="d-flex flex-column gap-2">
          {SLOT_LABELS.map((slot) => {
            const values = spacy.slots?.[slot.key] ?? [];
            return (
              <div key={slot.key}>
                <div className="small text-muted mb-1">{slot.label}</div>
                {values.length > 0 ? (
                  <div className="d-flex flex-wrap gap-1">
                    {values.map((value) => (
                      <span key={`${slot.key}:${value}`} className="badge text-bg-light border">
                        {value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="small text-muted">-</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h6 className="mb-2">Entities</h6>
        {spacy.ents.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Text</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {spacy.ents.map((entity, index) => (
                  <tr key={`${entity.label}:${entity.start}:${entity.end}:${index}`}>
                    <td>{entity.label}</td>
                    <td>{entity.text}</td>
                    <td>{entity.start}</td>
                    <td>{entity.end}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="small text-muted">No entities found.</div>
        )}
      </section>

      <section>
        <h6 className="mb-2">By Label</h6>
        {byLabelEntries.length > 0 ? (
          <div className="d-flex flex-column gap-2">
            {byLabelEntries.map(([label, values]) => (
              <div key={label}>
                <div className="small text-muted mb-1">{label}</div>
                {values.length > 0 ? (
                  <div className="d-flex flex-wrap gap-1">
                    {values.map((value) => (
                      <span key={`${label}:${value}`} className="badge text-bg-light border">
                        {value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="small text-muted">-</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="small text-muted">No grouped labels.</div>
        )}
      </section>

      {spacy.warnings.length > 0 ? (
        <section>
          <h6 className="mb-2">Warnings</h6>
          <ul className="mb-0">
            {spacy.warnings.map((warning) => (
              <li key={warning} className="small">
                {warning}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default SpacyExtractionPanel;
