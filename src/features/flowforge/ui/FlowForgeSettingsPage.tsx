import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getFlowForgeSettings, updateFlowForgeSettings } from "../api/adminApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import "./flowforge.css";
import "./flowforgeAdmin.css";

const splitEmails = (value: string) =>
  value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

type SettingsToggleProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function SettingsToggle({ checked, label, onChange }: SettingsToggleProps) {
  const labelId = useId();

  return (
    <div className="ff-settings-toggle-row">
      <span id={labelId} className="ff-settings-toggle-label">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        className={`ff-toggle-switch ${checked ? "is-on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="ff-toggle-switch-knob" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function FlowForgeSettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["flowforge", "admin", "settings"],
    queryFn: getFlowForgeSettings,
  });
  const [enabled, setEnabled] = useState(false);
  const [allowDesignerPublish, setAllowDesignerPublish] = useState(false);
  const [retentionDays, setRetentionDays] = useState("30");
  const [offerTimeoutMinutes, setOfferTimeoutMinutes] = useState("1440");
  const [noMatchRecipients, setNoMatchRecipients] = useState("");
  const [testRecipients, setTestRecipients] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(settingsQuery.data.enabled);
    setAllowDesignerPublish(settingsQuery.data.allow_designer_publish);
    setRetentionDays(String(settingsQuery.data.raw_payload_retention_days));
    setOfferTimeoutMinutes(String(settingsQuery.data.default_offer_timeout_minutes));
    setNoMatchRecipients(settingsQuery.data.default_no_match_recipients.join(", "));
    setTestRecipients(settingsQuery.data.default_test_recipients.join(", "));
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateFlowForgeSettings({
        enabled,
        allow_designer_publish: allowDesignerPublish,
        raw_payload_retention_days: Number(retentionDays),
        default_offer_timeout_minutes: Number(offerTimeoutMinutes),
        default_no_match_recipients: splitEmails(noMatchRecipients),
        default_test_recipients: splitEmails(testRecipients),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "settings"] });
    },
  });

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Settings"
        description="Configure workspace defaults used by intake retention, test mode, offer loops, and no-match escalation."
      />
      <section className="ff-runtime-panel ff-settings-panel">
        <form
          className="ff-admin-form ff-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="ff-settings-section">
            <header>
              <h2>Runtime Controls</h2>
              <p>Enable the workspace runtime and choose who can publish workflow drafts.</p>
            </header>
            <SettingsToggle label="Enable Workflow Runtime" checked={enabled} onChange={setEnabled} />
            <SettingsToggle label="Allow Designer Publish" checked={allowDesignerPublish} onChange={setAllowDesignerPublish} />
          </div>

          <div className="ff-settings-section">
            <header>
              <h2>Timing Defaults</h2>
              <p>Keep retention and offer windows explicit so operators know when workflow state expires.</p>
            </header>
            <div className="ff-settings-field-grid">
              <label>
                Raw Payload Retention Days
                <input value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
              </label>
              <label>
                Default Offer Timeout Minutes
                <input value={offerTimeoutMinutes} onChange={(event) => setOfferTimeoutMinutes(event.target.value)} />
              </label>
            </div>
          </div>

          <div className="ff-settings-section">
            <header>
              <h2>Notification Defaults</h2>
              <p>Use comma-separated email addresses for workspace fallback recipients.</p>
            </header>
            <label>
              Default No-Match Recipients
              <textarea value={noMatchRecipients} onChange={(event) => setNoMatchRecipients(event.target.value)} />
            </label>
            <label>
              Default Test Recipients
              <textarea value={testRecipients} onChange={(event) => setTestRecipients(event.target.value)} />
            </label>
          </div>

          <div className="ff-settings-actions">
            {mutation.isError ? <div className="ff-empty-state">Unable to save Workflow Studio settings.</div> : null}
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
