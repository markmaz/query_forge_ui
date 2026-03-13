type FocusFilter = "all" | "ambiguous" | "no_match" | "low_confidence" | "accepted" | "manual";

type Props = {
  ambiguous: number;
  noMatch: number;
  lowConfidence: number;
  onSetFocus: (focus: FocusFilter) => void;
};

export type { FocusFilter };

export default function ForgeMatchTriagePanel({ ambiguous, noMatch, lowConfidence, onSetFocus }: Props) {
  const totalAttention = ambiguous + noMatch + lowConfidence;

  return (
    <section className="fm-card fm-triage" aria-label="Needs attention triage panel">
      <div>
        <h2 className="fm-card-title">Needs Attention</h2>
        <p className="fm-card-subtitle">Prioritize risk areas before finalizing mapping outputs.</p>
      </div>

      {totalAttention === 0 ? (
        <div className="fm-triage-empty" role="status">No high-priority triage items detected.</div>
      ) : (
        <>
          <ul className="fm-triage-list mb-0">
            {ambiguous > 0 ? <li>{ambiguous} ambiguous mappings need review.</li> : null}
            {noMatch > 0 ? <li>{noMatch} fields have no confident match.</li> : null}
            {lowConfidence > 0 ? <li>{lowConfidence} low-confidence suggestions should be verified.</li> : null}
          </ul>

          <div className="fm-triage-actions">
            <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onSetFocus("ambiguous")}>Review Ambiguous</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onSetFocus("no_match")}>Review No Match</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onSetFocus("low_confidence")}>Review Low Confidence</button>
          </div>
        </>
      )}
    </section>
  );
}
