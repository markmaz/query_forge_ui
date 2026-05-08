import type { FlowForgeIntegrationConfig } from "../model/adminTypes";
import type { IntakeContextFieldOption } from "../model/matchingPolicyIntakeContext";

type MatchingPolicyIntakeSourcePanelProps = {
  intakeIntegrationKey: string;
  intakeEventKey: string;
  intakeSourceOptions: FlowForgeIntegrationConfig[];
  selectedIntakeIntegration: FlowForgeIntegrationConfig | null;
  intakeContextFields: IntakeContextFieldOption[];
  onIntegrationChange: (integrationKey: string) => void;
  onEventChange: (eventKey: string) => void;
};

export default function MatchingPolicyIntakeSourcePanel({
  intakeIntegrationKey,
  intakeEventKey,
  intakeSourceOptions,
  selectedIntakeIntegration,
  intakeContextFields,
  onIntegrationChange,
  onEventChange,
}: MatchingPolicyIntakeSourcePanelProps) {
  return (
    <section className="ff-policy-intake-section" aria-label="Optional intake source">
      <div>
        <h3>Optional Intake Source</h3>
        <p>Use fields from a configured intake integration when rules compare resources to incoming request data.</p>
      </div>
      <div className="ff-settings-field-grid">
        <label>
          Intake Source
          <select value={intakeIntegrationKey} onChange={(event) => onIntegrationChange(event.target.value)}>
            <option value="">No intake source</option>
            {intakeSourceOptions.map((integration) => (
              <option key={integration.integration_key} value={integration.integration_key}>
                {integration.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Intake Event
          <select
            value={intakeEventKey}
            disabled={!selectedIntakeIntegration || !selectedIntakeIntegration.source_events.length}
            onChange={(event) => onEventChange(event.target.value)}
          >
            <option value="">Any event</option>
            {(selectedIntakeIntegration?.source_events ?? []).map((sourceEvent) => (
              <option key={sourceEvent.event_key} value={sourceEvent.event_key}>
                {sourceEvent.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selectedIntakeIntegration ? (
        <div className="ff-policy-intake-field-list" aria-label="Available intake fields">
          {intakeContextFields.map((field) => (
            <span key={field.key} className="ff-policy-intake-field-pill">
              {field.label}
              <small>{field.type}</small>
            </span>
          ))}
        </div>
      ) : (
        <p className="ff-admin-helper">Optional. Leave blank for policies that use only resource fields and fixed values.</p>
      )}
    </section>
  );
}
