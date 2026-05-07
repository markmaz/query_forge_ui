import type { FlowForgeNode } from "../model/types";

type ScheduleFrequency = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";

type ScheduleDraft = {
  frequency: ScheduleFrequency;
  interval: number;
  days: string[];
  monthDay: number;
  startDate: string;
  runTime: string;
  endDate: string;
};

const WEEKDAY_CHOICES = [
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
  { value: "SU", label: "Sun" },
];

function rrulePart(rrule: string, key: string): string | null {
  const match = rrule
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toUpperCase().startsWith(`${key}=`));
  return match ? match.slice(key.length + 1) : null;
}

function dateFromUntil(until: string | null): string {
  if (!until || until.length < 8) return "";
  return `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`;
}

function scheduleDraftFromData(data: Record<string, unknown>): ScheduleDraft {
  const rrule = String(data.rrule ?? "FREQ=DAILY;INTERVAL=1").toUpperCase();
  const frequency = (rrulePart(rrule, "FREQ") ?? "DAILY") as ScheduleFrequency;
  const interval = Number(rrulePart(rrule, "INTERVAL") ?? data.interval ?? 1);
  const monthDay = Number(rrulePart(rrule, "BYMONTHDAY") ?? data.month_day ?? 1);
  return {
    frequency: ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"].includes(frequency) ? frequency : "DAILY",
    interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
    days: (rrulePart(rrule, "BYDAY") ?? String(data.days ?? ""))
      .split(",")
      .map((day) => day.trim())
      .filter((day) => WEEKDAY_CHOICES.some((choice) => choice.value === day)),
    monthDay: Number.isFinite(monthDay) ? Math.max(1, Math.min(31, monthDay)) : 1,
    startDate: String(data.start_date ?? ""),
    runTime: String(data.run_time ?? "09:00"),
    endDate: String(data.end_date ?? dateFromUntil(rrulePart(rrule, "UNTIL"))),
  };
}

function buildScheduleData(data: Record<string, unknown>, draft: ScheduleDraft): Record<string, unknown> {
  const parts = [`FREQ=${draft.frequency}`, `INTERVAL=${Math.max(1, draft.interval)}`];
  if (draft.frequency === "WEEKLY" && draft.days.length) parts.push(`BYDAY=${draft.days.join(",")}`);
  if (draft.frequency === "MONTHLY") parts.push(`BYMONTHDAY=${Math.max(1, Math.min(31, draft.monthDay))}`);
  if (draft.endDate) parts.push(`UNTIL=${draft.endDate.replaceAll("-", "")}T235959Z`);
  return {
    ...data,
    rrule: parts.join(";"),
    start_date: draft.startDate,
    run_time: draft.runTime,
    end_date: draft.endDate,
  };
}

function scheduleSummary(draft: ScheduleDraft): string {
  const intervalText = draft.interval > 1 ? ` every ${draft.interval}` : "";
  if (draft.frequency === "HOURLY") return `Runs${intervalText} hour${draft.interval === 1 ? "" : "s"}.`;
  if (draft.frequency === "DAILY") return `Runs${intervalText} day${draft.interval === 1 ? "" : "s"} at ${draft.runTime || "the selected time"}.`;
  if (draft.frequency === "MONTHLY") return `Runs${intervalText} month${draft.interval === 1 ? "" : "s"} on day ${draft.monthDay}.`;
  const days = draft.days.length ? draft.days.join(", ") : "selected days";
  return `Runs${intervalText} week${draft.interval === 1 ? "" : "s"} on ${days} at ${draft.runTime || "the selected time"}.`;
}

export default function ScheduleTriggerBuilder({
  node,
  editable,
  onChange,
}: {
  node: FlowForgeNode;
  editable: boolean;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const draft = scheduleDraftFromData(node.data);
  const commit = (patch: Partial<ScheduleDraft>) => {
    const nextDraft = {
      ...draft,
      ...patch,
    };
    onChange(buildScheduleData(node.data, nextDraft));
  };
  const toggleDay = (day: string, checked: boolean) => {
    const nextDays = checked ? Array.from(new Set([...draft.days, day])) : draft.days.filter((entry) => entry !== day);
    commit({ days: WEEKDAY_CHOICES.filter((choice) => nextDays.includes(choice.value)).map((choice) => choice.value) });
  };

  return (
    <div className="ff-field-group ff-schedule-builder">
      <div>
        <div className="ff-field-label">Schedule</div>
        <span className="ff-field-helper">Choose when this workflow starts. Workflow Studio will save the recurrence rule for runtime execution.</span>
      </div>
      <div className="ff-schedule-grid">
        <label>
          Repeat
          <select
            value={draft.frequency}
            disabled={!editable}
            onChange={(event) => commit({ frequency: event.target.value as ScheduleFrequency })}
          >
            <option value="HOURLY">Hourly</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
        <label>
          Every
          <input
            min={1}
            step={1}
            type="number"
            value={draft.interval}
            disabled={!editable}
            onChange={(event) => commit({ interval: Math.max(1, Number(event.target.value) || 1) })}
          />
        </label>
        <label>
          Starts on
          <input
            type="date"
            value={draft.startDate}
            disabled={!editable}
            onChange={(event) => commit({ startDate: event.target.value })}
          />
        </label>
        <label>
          Time
          <input
            type="time"
            value={draft.runTime}
            disabled={!editable || draft.frequency === "HOURLY"}
            onChange={(event) => commit({ runTime: event.target.value })}
          />
        </label>
        <label>
          Ends on
          <input
            type="date"
            value={draft.endDate}
            disabled={!editable}
            onChange={(event) => commit({ endDate: event.target.value })}
          />
        </label>
        {draft.frequency === "MONTHLY" ? (
          <label>
            Day of month
            <input
              min={1}
              max={31}
              step={1}
              type="number"
              value={draft.monthDay}
              disabled={!editable}
              onChange={(event) => commit({ monthDay: Math.max(1, Math.min(31, Number(event.target.value) || 1)) })}
            />
          </label>
        ) : null}
      </div>
      {draft.frequency === "WEEKLY" ? (
        <div className="ff-schedule-days" aria-label="Run on days">
          {WEEKDAY_CHOICES.map((choice) => (
            <label key={choice.value} className="ff-schedule-day">
              <input
                type="checkbox"
                checked={draft.days.includes(choice.value)}
                disabled={!editable}
                onChange={(event) => toggleDay(choice.value, event.target.checked)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
      ) : null}
      <div className="ff-schedule-summary">{scheduleSummary(draft)}</div>
    </div>
  );
}
