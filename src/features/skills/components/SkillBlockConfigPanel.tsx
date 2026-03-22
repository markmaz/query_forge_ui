import type {
  SkillActionBlock,
  SkillConditionBlock,
  SkillScheduleUpcoming,
  SkillSchedulerHealth,
  SkillScheduleValidationResult,
  SkillTriggerBlock,
} from "../types";
import { DestinationPicker } from "./DestinationForm";

type Props = {
  workspaceId: string;
  selectedTrigger: SkillTriggerBlock | null;
  selectedCondition: SkillConditionBlock | null;
  selectedAction: SkillActionBlock | null;
  onUpdateTrigger: (patch: Record<string, unknown>) => void;
  onUpdateCondition: (id: string, patch: Record<string, unknown>) => void;
  onUpdateAction: (id: string, patch: Record<string, unknown>) => void;
  onManageDestinations?: () => void;
  scheduleValidation?: SkillScheduleValidationResult | null;
  schedulerHealth?: SkillSchedulerHealth | null;
  savedSchedule?: SkillScheduleUpcoming | null;
  scheduleLoading?: boolean;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asDestinationId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function webhookModeForConfig(config: Record<string, unknown>): "destination" | "manual" {
  const explicit = asString(config.delivery_target_mode).trim().toLowerCase();
  if (explicit === "destination" || explicit === "manual") return explicit;
  return asDestinationId(config.destination_id) ? "destination" : "manual";
}

export default function SkillBlockConfigPanel({
  workspaceId,
  selectedTrigger,
  selectedCondition,
  selectedAction,
  onUpdateTrigger,
  onUpdateCondition,
  onUpdateAction,
  onManageDestinations,
  scheduleValidation = null,
  schedulerHealth = null,
  savedSchedule = null,
  scheduleLoading = false,
}: Props) {
  const selectedLabel = selectedTrigger?.label || selectedCondition?.label || selectedAction?.label || "Block Configuration";
  const selectedKind = selectedTrigger ? "Trigger" : selectedCondition ? "Condition" : selectedAction ? "Action" : null;

  if (!selectedTrigger && !selectedCondition && !selectedAction) {
    return (
      <div className="skills-config-panel card border-0 shadow-sm">
        <div className="card-body">
          <h3 className="h6 mb-2">Configure Workflow</h3>
          <p className="text-muted mb-0">Select a trigger, condition, or delivery action to edit its settings.</p>
        </div>
      </div>
    );
  }

  const renderTriggerFields = (block: SkillTriggerBlock) => {
    switch (block.type) {
      case "schedule":
        return (
          <>
            <label className="form-label">Frequency</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.frequency, "daily")}
              onChange={(event) => onUpdateTrigger({ frequency: event.target.value })}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>

            {asString(block.config.frequency, "daily") === "weekly" ? (
              <>
                <label className="form-label">Day</label>
                <select
                  className="form-select mb-2"
                  value={asString(block.config.day_of_week, "monday")}
                  onChange={(event) => onUpdateTrigger({ day_of_week: event.target.value })}
                >
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </>
            ) : null}

            {asString(block.config.frequency, "daily") !== "hourly" ? (
              <>
                <label className="form-label">Time</label>
                <input
                  type="time"
                  className="form-control mb-2"
                  value={asString(block.config.time, "08:00")}
                  onChange={(event) => onUpdateTrigger({ time: event.target.value })}
                />
              </>
            ) : null}

            <label className="form-label">Timezone</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.timezone, "America/Chicago")}
              onChange={(event) => onUpdateTrigger({ timezone: event.target.value })}
            />

            <div className="form-check">
              <input
                className="form-check-input"
                id="trigger-active"
                type="checkbox"
                checked={asBoolean(block.config.active, true)}
                onChange={(event) => onUpdateTrigger({ active: event.target.checked })}
              />
              <label className="form-check-label" htmlFor="trigger-active">
                Trigger is active
              </label>
            </div>

            <div className="skills-schedule-panel mt-3">
              {savedSchedule ? (
                <>
                  <div className="skills-schedule-panel__row">
                    <span className="skills-schedule-panel__label">Saved schedule</span>
                    <span className="skills-schedule-chip is-neutral">Persisted</span>
                  </div>
                  {savedSchedule.cronExpression ? (
                    <p className="skills-schedule-panel__note">
                      Saved cron: <code>{savedSchedule.cronExpression}</code>
                    </p>
                  ) : null}
                  {savedSchedule.reason ? (
                    <p className="skills-schedule-panel__note">{savedSchedule.reason}</p>
                  ) : null}
                  {savedSchedule.upcoming.length ? (
                    <ul className="skills-schedule-panel__list">
                      {savedSchedule.upcoming.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  <hr className="skills-schedule-panel__divider" />
                </>
              ) : null}
              <div className="skills-schedule-panel__row">
                <span className="skills-schedule-panel__label">Scheduler</span>
                <span className={`skills-schedule-chip ${schedulerHealth?.healthy ? "is-ok" : "is-warn"}`}>
                  {schedulerHealth?.healthy ? "Online" : "Check Beat"}
                </span>
              </div>
              {schedulerHealth?.reason ? (
                <p className="skills-schedule-panel__note">{schedulerHealth.reason}</p>
              ) : null}
              {scheduleLoading ? (
                <p className="skills-schedule-panel__note">Checking schedule preview…</p>
              ) : null}
              {!scheduleLoading && scheduleValidation ? (
                <>
                  <div className="skills-schedule-panel__row">
                    <span className="skills-schedule-panel__label">Draft preview</span>
                    <span className={`skills-schedule-chip ${scheduleValidation.valid ? "is-ok" : "is-warn"}`}>
                      {scheduleValidation.valid ? "Valid" : "Needs attention"}
                    </span>
                  </div>
                  {scheduleValidation.cronExpression ? (
                    <p className="skills-schedule-panel__note">
                      Cron: <code>{scheduleValidation.cronExpression}</code>
                    </p>
                  ) : null}
                  {scheduleValidation.errors.length ? (
                    <ul className="skills-schedule-panel__list">
                      {scheduleValidation.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  ) : null}
                  {scheduleValidation.upcoming.length ? (
                    <>
                      <div className="skills-schedule-panel__label">Upcoming runs</div>
                      <ul className="skills-schedule-panel__list">
                        {scheduleValidation.upcoming.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </>
        );
      case "query_run":
        return (
          <>
            <label className="form-label">Run mode</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.run_mode, "both")}
              onChange={(event) => onUpdateTrigger({ run_mode: event.target.value })}
            >
              <option value="manual">Manual runs</option>
              <option value="scheduled">Scheduled runs</option>
              <option value="both">Both</option>
            </select>

            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="trigger-success-only"
                checked={asBoolean(block.config.on_success_only, true)}
                onChange={(event) => onUpdateTrigger({ on_success_only: event.target.checked })}
              />
              <label className="form-check-label" htmlFor="trigger-success-only">
                Trigger on success only
              </label>
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="trigger-include-failures"
                checked={asBoolean(block.config.include_failures, false)}
                onChange={(event) => onUpdateTrigger({ include_failures: event.target.checked })}
              />
              <label className="form-check-label" htmlFor="trigger-include-failures">
                Include failures (placeholder)
              </label>
            </div>
          </>
        );
      case "threshold_alert":
        return (
          <>
            <label className="form-label">Metric</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.metric)}
              onChange={(event) => onUpdateTrigger({ metric: event.target.value })}
            />
            <label className="form-label">Operator</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.operator, ">")}
              onChange={(event) => onUpdateTrigger({ operator: event.target.value })}
            >
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value="=">=</option>
            </select>
            <label className="form-label">Threshold</label>
            <input
              type="number"
              className="form-control mb-2"
              value={asNumber(block.config.threshold, 0)}
              onChange={(event) => onUpdateTrigger({ threshold: Number(event.target.value) })}
            />
            <label className="form-label">Compare against</label>
            <select
              className="form-select"
              value={asString(block.config.compare_mode, "latest")}
              onChange={(event) => onUpdateTrigger({ compare_mode: event.target.value })}
            >
              <option value="latest">Latest result</option>
              <option value="previous">Previous result</option>
              <option value="rolling_average">Rolling average (placeholder)</option>
            </select>
          </>
        );
      case "data_freshness_check":
        return (
          <>
            <label className="form-label">Freshness column</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.freshness_column)}
              onChange={(event) => onUpdateTrigger({ freshness_column: event.target.value })}
            />
            <label className="form-label">Expected cadence</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.expected_cadence, "daily")}
              onChange={(event) => onUpdateTrigger({ expected_cadence: event.target.value })}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <label className="form-label">No new rows for interval</label>
            <div className="d-flex gap-2">
              <input
                type="number"
                className="form-control"
                value={asNumber(block.config.interval_value, 1)}
                onChange={(event) => onUpdateTrigger({ interval_value: Number(event.target.value) })}
              />
              <select
                className="form-select"
                value={asString(block.config.interval_unit, "day")}
                onChange={(event) => onUpdateTrigger({ interval_unit: event.target.value })}
              >
                <option value="hour">Hours</option>
                <option value="day">Days</option>
                <option value="week">Weeks</option>
              </select>
            </div>
          </>
        );
      default:
        return (
          <>
            <label className="form-label">Notes</label>
            <textarea
              className="form-control"
              rows={3}
              value={asString(block.config.notes)}
              onChange={(event) => onUpdateTrigger({ notes: event.target.value })}
            />
          </>
        );
    }
  };

  const renderConditionFields = (block: SkillConditionBlock) => {
    const update = (patch: Record<string, unknown>) => onUpdateCondition(block.id, patch);

    switch (block.type) {
      case "metric_threshold":
        return (
          <>
            <label className="form-label">Metric</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.metric)}
              onChange={(event) => update({ metric: event.target.value })}
            />
            <label className="form-label">Operator</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.operator, ">")}
              onChange={(event) => update({ operator: event.target.value })}
            >
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value="=">=</option>
            </select>
            <label className="form-label">Value</label>
            <input
              type="number"
              className="form-control"
              value={asNumber(block.config.value, 0)}
              onChange={(event) => update({ value: Number(event.target.value) })}
            />
          </>
        );
      case "row_count_threshold":
        return (
          <>
            <label className="form-label">Operator</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.operator, ">")} 
              onChange={(event) => update({ operator: event.target.value })}
            >
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value="=">=</option>
            </select>
            <label className="form-label">Value</label>
            <input
              type="number"
              className="form-control"
              value={asNumber(block.config.value, 0)}
              onChange={(event) => update({ value: Number(event.target.value) })}
            />
          </>
        );
      case "changed_result":
        return (
          <>
            <label className="form-label">Change type</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.change_type, "any")}
              onChange={(event) => update({ change_type: event.target.value })}
            >
              <option value="any">Any change</option>
              <option value="increase">Increase only</option>
              <option value="decrease">Decrease only</option>
            </select>
            <label className="form-label">Minimum % change</label>
            <input
              type="number"
              className="form-control"
              value={asNumber(block.config.minimum_percent_change, 0)}
              onChange={(event) => update({ minimum_percent_change: Number(event.target.value) })}
            />
          </>
        );
      case "no_new_rows":
        return (
          <>
            <label className="form-label">No new rows in interval</label>
            <div className="d-flex gap-2">
              <input
                type="number"
                className="form-control"
                value={asNumber(block.config.interval_value, 1)}
                onChange={(event) => update({ interval_value: Number(event.target.value) })}
              />
              <select
                className="form-select"
                value={asString(block.config.interval_unit, "day")}
                onChange={(event) => update({ interval_unit: event.target.value })}
              >
                <option value="hour">Hours</option>
                <option value="day">Days</option>
                <option value="week">Weeks</option>
              </select>
            </div>
          </>
        );
      default:
        return (
          <>
            <label className="form-label">Expression</label>
            <textarea
              className="form-control"
              rows={4}
              value={asString(block.config.expression)}
              onChange={(event) => update({ expression: event.target.value })}
            />
          </>
        );
    }
  };

  const renderActionFields = (block: SkillActionBlock) => {
    const update = (patch: Record<string, unknown>) => onUpdateAction(block.id, patch);

    switch (block.type) {
      case "email_report":
        return (
          <>
            <label className="form-label">Saved destination</label>
            <div className="mb-2">
              <DestinationPicker
                workspaceId={workspaceId}
                channelType="email_group"
                value={asDestinationId(block.config.destination_id)}
                onChange={(destinationId: number | null) => update({ destination_id: destinationId })}
                onManageClick={() => onManageDestinations?.()}
              />
            </div>
            <label className="form-label">Recipients</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.recipients)}
              onChange={(event) => update({ recipients: event.target.value })}
              placeholder="finance@company.com, ops@company.com"
            />
            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="form-label">CC</label>
                <input
                  className="form-control"
                  value={asString(block.config.cc)}
                  onChange={(event) => update({ cc: event.target.value })}
                />
              </div>
              <div className="col-6">
                <label className="form-label">BCC</label>
                <input
                  className="form-control"
                  value={asString(block.config.bcc)}
                  onChange={(event) => update({ bcc: event.target.value })}
                />
              </div>
            </div>
            <label className="form-label">Subject</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.subject)}
              onChange={(event) => update({ subject: event.target.value })}
            />
            <label className="form-label">Message body</label>
            <textarea
              className="form-control mb-2"
              rows={3}
              value={asString(block.config.message_body)}
              onChange={(event) => update({ message_body: event.target.value })}
            />
            <div className="d-flex flex-wrap gap-3">
              {[
                ["include_table", "Include table"],
                ["include_chart", "Include chart"],
                ["include_csv", "Include CSV"],
                ["include_ai_summary", "Include AI summary"],
              ].map(([key, label]) => (
                <div className="form-check" key={key}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`email-${key}`}
                    checked={asBoolean(block.config[key], false)}
                    onChange={(event) => update({ [key]: event.target.checked })}
                  />
                  <label className="form-check-label" htmlFor={`email-${key}`}>
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </>
        );
      case "ai_summary_digest":
        return (
          <>
            <label className="form-label">Saved destination</label>
            <div className="mb-2">
              <DestinationPicker
                workspaceId={workspaceId}
                channelType="email_group"
                value={asDestinationId(block.config.destination_id)}
                onChange={(destinationId: number | null) => update({ destination_id: destinationId })}
                onManageClick={() => onManageDestinations?.()}
              />
            </div>
            <label className="form-label">Recipients</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.recipients)}
              onChange={(event) => update({ recipients: event.target.value })}
              placeholder="finance@company.com, ops@company.com"
            />
            <label className="form-label">Subject</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.subject, "{{query_name}} Digest")}
              onChange={(event) => update({ subject: event.target.value })}
            />
            <label className="form-label">Summary style</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.summary_style, "executive")}
              onChange={(event) => update({ summary_style: event.target.value })}
            >
              <option value="executive">Executive</option>
              <option value="detailed">Detailed</option>
              <option value="bullet">Bullet points</option>
            </select>
            <label className="form-label">Prompt template</label>
            <textarea
              className="form-control mb-2"
              rows={3}
              value={asString(block.config.prompt_template)}
              onChange={(event) => update({ prompt_template: event.target.value })}
            />
            <label className="form-label">Destinations</label>
            <input
              className="form-control mb-2"
              value={asString(block.config.destinations)}
              onChange={(event) => update({ destinations: event.target.value })}
              placeholder="email, slack"
            />
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label">Length</label>
                <select
                  className="form-select"
                  value={asString(block.config.length, "short")}
                  onChange={(event) => update({ length: event.target.value })}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Tone</label>
                <select
                  className="form-select"
                  value={asString(block.config.tone, "professional")}
                  onChange={(event) => update({ tone: event.target.value })}
                >
                  <option value="professional">Professional</option>
                  <option value="analytical">Analytical</option>
                  <option value="conversational">Conversational</option>
                </select>
              </div>
            </div>
          </>
        );
      case "webhook_delivery": {
        const channelType = asString(block.config.channel_type, "slack");
        const destinationType = channelType === "webhook" ? "webhook" : channelType;
        const isGenericWebhook = channelType === "webhook";
        const targetMode = webhookModeForConfig(block.config);
        return (
          <>
            <label className="form-label">Channel</label>
            <select
              className="form-select mb-2"
              value={channelType}
              onChange={(event) =>
                update({
                  channel_type: event.target.value,
                  delivery_target_mode: "manual",
                  destination_id: null,
                  endpoint_url: "",
                  webhook_url: "",
                  url: "",
                })
              }
            >
              <option value="slack">Slack</option>
              <option value="teams">Microsoft Teams</option>
              <option value="webhook">Generic Webhook</option>
            </select>
            <label className="form-label">Delivery target</label>
            <div className="skills-segmented-control mb-2" role="group" aria-label="Delivery target mode">
              <button
                type="button"
                className={`skills-segmented-control__button ${targetMode === "destination" ? "is-active" : ""}`}
                onClick={() =>
                  update({
                    delivery_target_mode: "destination",
                    destination_id: asDestinationId(block.config.destination_id),
                    endpoint_url: "",
                    webhook_url: "",
                    url: "",
                  })
                }
              >
                Saved destination
              </button>
              <button
                type="button"
                className={`skills-segmented-control__button ${targetMode === "manual" ? "is-active" : ""}`}
                onClick={() => update({ delivery_target_mode: "manual", destination_id: null })}
              >
                Enter manually
              </button>
            </div>
            {targetMode === "destination" ? (
              <>
                <label className="form-label">Saved destination</label>
                <div className="mb-2">
                  <DestinationPicker
                    workspaceId={workspaceId}
                    channelType={destinationType}
                    value={asDestinationId(block.config.destination_id)}
                    onChange={(destinationId: number | null) =>
                      update({
                        delivery_target_mode: destinationId ? "destination" : "manual",
                        destination_id: destinationId,
                        endpoint_url: "",
                        webhook_url: "",
                        url: "",
                      })
                    }
                    onManageClick={() => onManageDestinations?.()}
                  />
                </div>
                <div className="skills-config-panel__hint mb-2">
                  This action will use the saved destination configuration. Manual webhook fields are hidden while a destination is attached.
                </div>
              </>
            ) : (
              <>
                <label className="form-label">{isGenericWebhook ? "Endpoint URL" : "Webhook URL"}</label>
                <input
                  className="form-control mb-2"
                  value={asString(block.config.endpoint_url || block.config.webhook_url)}
                  onChange={(event) =>
                    update({
                      delivery_target_mode: "manual",
                      destination_id: null,
                      endpoint_url: event.target.value,
                      webhook_url: event.target.value,
                      url: event.target.value,
                    })
                  }
                  placeholder={
                    isGenericWebhook
                      ? "https://hooks.example.com/queryforge"
                      : "https://hooks.slack.com/services/..."
                  }
                />
                {isGenericWebhook ? (
                  <>
                    <label className="form-label">Method</label>
                    <select
                      className="form-select mb-2"
                      value={asString(block.config.method, "POST")}
                      onChange={(event) => update({ method: event.target.value })}
                    >
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                    </select>
                    <label className="form-label">Headers JSON</label>
                    <textarea
                      className="form-control font-monospace mb-2"
                      rows={3}
                      value={asString(block.config.headers_json, "{}")}
                      onChange={(event) => update({ headers_json: event.target.value })}
                    />
                  </>
                ) : null}
              </>
            )}
            <label className="form-label">Payload template</label>
            <select
              className="form-select mb-2"
              value={asString(block.config.payload_template, "default")}
              onChange={(event) => update({ payload_template: event.target.value })}
            >
              <option value="default">Default payload</option>
              <option value="summary_only">Summary only</option>
              <option value="full_result">Full result (placeholder)</option>
            </select>
            <label className="form-label">Retry policy</label>
            <select
              className="form-select"
              value={asString(block.config.retry_policy, "standard")}
              onChange={(event) => update({ retry_policy: event.target.value })}
            >
              <option value="standard">Standard</option>
              <option value="aggressive">Aggressive</option>
              <option value="none">None</option>
            </select>
          </>
        );
      }
      case "slack_delivery": {
        const targetMode = webhookModeForConfig(block.config);
        return (
          <>
            <label className="form-label">Delivery target</label>
            <div className="skills-segmented-control mb-2" role="group" aria-label="Delivery target mode">
              <button
                type="button"
                className={`skills-segmented-control__button ${targetMode === "destination" ? "is-active" : ""}`}
                onClick={() =>
                  update({
                    delivery_target_mode: "destination",
                    destination_id: asDestinationId(block.config.destination_id),
                    webhook_url: "",
                  })
                }
              >
                Saved destination
              </button>
              <button
                type="button"
                className={`skills-segmented-control__button ${targetMode === "manual" ? "is-active" : ""}`}
                onClick={() => update({ delivery_target_mode: "manual", destination_id: null })}
              >
                Enter manually
              </button>
            </div>
            {targetMode === "destination" ? (
              <>
                <label className="form-label">Saved destination</label>
                <div className="mb-2">
                  <DestinationPicker
                    workspaceId={workspaceId}
                    channelType="slack"
                    value={asDestinationId(block.config.destination_id)}
                    onChange={(destinationId: number | null) =>
                      update({
                        delivery_target_mode: destinationId ? "destination" : "manual",
                        destination_id: destinationId,
                        webhook_url: "",
                      })
                    }
                    onManageClick={() => onManageDestinations?.()}
                  />
                </div>
                <div className="skills-config-panel__hint mb-2">
                  This Slack action will use the saved destination configuration. Manual webhook entry is hidden while a destination is attached.
                </div>
              </>
            ) : (
              <>
                <label className="form-label">Slack webhook URL</label>
                <input
                  className="form-control mb-2"
                  value={asString(block.config.webhook_url)}
                  onChange={(event) =>
                    update({
                      delivery_target_mode: "manual",
                      destination_id: null,
                      webhook_url: event.target.value,
                    })
                  }
                  placeholder="https://hooks.slack.com/services/..."
                />
              </>
            )}
            <label className="form-label">Message template</label>
            <textarea
              className="form-control mb-2"
              rows={3}
              value={asString(block.config.message_template)}
              onChange={(event) => update({ message_template: event.target.value })}
            />
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                id="slack-include-summary"
                type="checkbox"
                checked={asBoolean(block.config.include_summary, true)}
                onChange={(event) => update({ include_summary: event.target.checked })}
              />
              <label className="form-check-label" htmlFor="slack-include-summary">
                Include summary
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                id="slack-include-table"
                type="checkbox"
                checked={asBoolean(block.config.include_table_preview, false)}
                onChange={(event) => update({ include_table_preview: event.target.checked })}
              />
              <label className="form-check-label" htmlFor="slack-include-table">
                Include table preview
              </label>
            </div>
          </>
        );
      }
      default:
        return (
          <>
            <label className="form-label">Message template</label>
            <textarea
              className="form-control mb-2"
              rows={3}
              value={asString(block.config.message_template)}
              onChange={(event) => update({ message_template: event.target.value })}
            />
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                id="slack-include-summary"
                type="checkbox"
                checked={asBoolean(block.config.include_summary, true)}
                onChange={(event) => update({ include_summary: event.target.checked })}
              />
              <label className="form-check-label" htmlFor="slack-include-summary">
                Include summary
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                id="slack-include-table"
                type="checkbox"
                checked={asBoolean(block.config.include_table_preview, false)}
                onChange={(event) => update({ include_table_preview: event.target.checked })}
              />
              <label className="form-check-label" htmlFor="slack-include-table">
                Include table preview
              </label>
            </div>
          </>
        );
    }
  };

  return (
    <div className="skills-config-panel card border-0 shadow-sm">
      <div className="card-body">
        <div className="mb-3">
          <div className="text-muted text-uppercase small fw-semibold mb-1">{selectedKind}</div>
          <h3 className="h6 mb-1">{selectedLabel}</h3>
          <p className="text-muted mb-0">
            {selectedAction
              ? "Attach a destination here, then adjust the delivery options for this action."
              : selectedTrigger
                ? "Set when this skill should run and how its schedule should behave."
                : "Adjust the logic that narrows when the skill should continue."}
          </p>
        </div>
        {selectedTrigger ? renderTriggerFields(selectedTrigger) : null}
        {selectedCondition ? renderConditionFields(selectedCondition) : null}
        {selectedAction ? renderActionFields(selectedAction) : null}
      </div>
    </div>
  );
}
