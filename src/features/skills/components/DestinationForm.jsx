/**
 * DestinationForm.jsx
 *
 * Add / edit a destination. Type-aware config fields.
 * Used inside DestinationsTab modal.
 *
 * Props:
 *   workspaceId   {number}
 *   destination   {object|null}  — null = create mode
 *   onSaved       {fn}
 *   onCancel      {fn}
 */

import { useState, useEffect } from "react";

const API = (wid) => `/api/v1/workspaces/${wid}/destinations`;

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}

const TYPE_OPTIONS = [
  { value: "slack",       label: "Slack",            icon: "💬" },
  { value: "teams",       label: "Microsoft Teams",  icon: "🟦" },
  { value: "webhook",     label: "Generic Webhook",  icon: "🔗" },
  { value: "email_group", label: "Email Group",      icon: "✉️"  },
];

export default function DestinationForm({ workspaceId, destination, onSaved, onCancel }) {
  const isEdit = !!destination;

  const [name, setName] = useState(destination?.name || "");
  const [description, setDescription] = useState(destination?.description || "");
  const [destType, setDestType] = useState(destination?.destination_type || "slack");
  const [config, setConfig] = useState(destination?.config || {});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  // Reset config when type changes (create mode only)
  useEffect(() => {
    if (!isEdit) setConfig({});
  }, [destType, isEdit]);

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const url = isEdit
        ? `${API(workspaceId)}/${destination.id}`
        : `${API(workspaceId)}/`;
      const method = isEdit ? "PUT" : "POST";
      await apiFetch(url, {
        method,
        body: { name, description, destination_type: destType, config },
      });
      onSaved();
    } catch (e) {
      setErrors([e.message]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={fStyles.form}>
      {errors.length > 0 && (
        <div style={fStyles.errorBanner}>
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      <FormField label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Finance Alerts"
          style={fStyles.input}
        />
      </FormField>

      <FormField label="Description" hint="Optional — shown in destination picker">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Slack channel for finance team"
          style={fStyles.input}
        />
      </FormField>

      {!isEdit && (
        <FormField label="Type">
          <div style={fStyles.typeGrid}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDestType(opt.value)}
                style={{
                  ...fStyles.typeOption,
                  ...(destType === opt.value ? fStyles.typeOptionSelected : {}),
                }}
              >
                <span style={{ fontSize: 18 }}>{opt.icon}</span>
                <span style={{ fontSize: 12, marginTop: 2 }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </FormField>
      )}

      <TypeConfigFields
        destType={destType}
        config={config}
        onChange={setConfig}
        isEdit={isEdit}
      />

      <div style={fStyles.actions}>
        <button onClick={onCancel} style={fStyles.secondaryBtn}>Cancel</button>
        <button onClick={save} disabled={saving || !name.trim()} style={fStyles.primaryBtn}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create destination"}
        </button>
      </div>
    </div>
  );
}

// ─── Type-specific config fields ───────────────────────────────────────────

function TypeConfigFields({ destType, config, onChange, isEdit }) {
  const update = (key, val) => onChange({ ...config, [key]: val });

  if (destType === "slack" || destType === "teams") {
    const label = destType === "slack" ? "Slack incoming webhook URL" : "Teams incoming webhook URL";
    const placeholder = destType === "slack"
      ? "https://hooks.slack.com/services/..."
      : "https://outlook.office.com/webhook/...";
    return (
      <FormField label={label} hint="Paste the full incoming webhook URL. It will be encrypted and masked after saving.">
        <input
          type="password"
          value={config.webhook_url || ""}
          onChange={(e) => update("webhook_url", e.target.value)}
          placeholder={isEdit ? "Leave blank to keep existing" : placeholder}
          style={fStyles.input}
          autoComplete="off"
        />
        {isEdit && config.webhook_url === "••••••" && (
          <div style={fStyles.maskedNote}>URL is saved — enter a new one to replace it.</div>
        )}
      </FormField>
    );
  }

  if (destType === "webhook") {
    return (
      <>
        <FormField label="URL" hint="The endpoint that will receive POST requests.">
          <input
            type="password"
            value={config.url || ""}
            onChange={(e) => update("url", e.target.value)}
            placeholder={isEdit ? "Leave blank to keep existing" : "https://your-endpoint.com/hook"}
            style={fStyles.input}
            autoComplete="off"
          />
          {isEdit && config.url === "••••••" && (
            <div style={fStyles.maskedNote}>URL is saved — enter a new one to replace it.</div>
          )}
        </FormField>
        <FormField label="Auth token (Bearer)" hint="Optional — sent as Authorization: Bearer <token>">
          <input
            type="password"
            value={config.auth_token || ""}
            onChange={(e) => update("auth_token", e.target.value)}
            placeholder={isEdit ? "Leave blank to keep existing" : "Optional"}
            style={fStyles.input}
            autoComplete="off"
          />
        </FormField>
        <FormField label="HTTP method">
          <select
            value={config.method || "POST"}
            onChange={(e) => update("method", e.target.value)}
            style={fStyles.input}
          >
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>
        </FormField>
      </>
    );
  }

  if (destType === "email_group") {
    return (
      <>
        <FormField label="Recipients" hint="Email addresses that will receive notifications.">
          <EmailListInput
            value={config.recipients || []}
            onChange={(v) => update("recipients", v)}
          />
        </FormField>
        <FormField label="From name" hint="Display name shown in the From field.">
          <input
            value={config.from_name || "QueryForge"}
            onChange={(e) => update("from_name", e.target.value)}
            style={fStyles.input}
          />
        </FormField>
        <FormField label="Reply-to" hint="Optional reply-to address.">
          <input
            type="email"
            value={config.reply_to || ""}
            onChange={(e) => update("reply_to", e.target.value)}
            placeholder="optional"
            style={fStyles.input}
          />
        </FormField>
      </>
    );
  }

  return null;
}

// ─── Email list input ──────────────────────────────────────────────────────

function EmailListInput({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const email = draft.trim();
    if (email && !value.includes(email)) { onChange([...value, email]); setDraft(""); }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="name@example.com"
          style={{ ...fStyles.input, flex: 1 }}
        />
        <button onClick={add} style={fStyles.secondaryBtn}>Add</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {value.map((addr) => (
          <span key={addr} style={fStyles.emailTag}>
            {addr}
            <button
              onClick={() => onChange(value.filter((e) => e !== addr))}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 10 }}
            >✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={fStyles.label}>{label}</div>
      {children}
      {hint && <div style={fStyles.hint}>{hint}</div>}
    </div>
  );
}

const fStyles = {
  form: { padding: "16px 18px 20px", overflowY: "auto" },
  input: { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--bs-border-color)", background: "var(--bs-body-bg)", color: "var(--bs-body-color)", fontSize: 13, boxSizing: "border-box" },
  label: { fontSize: 12, fontWeight: 500, marginBottom: 4, color: "var(--bs-secondary-color)" },
  hint: { fontSize: 11, color: "var(--bs-tertiary-color)", marginTop: 3 },
  maskedNote: { fontSize: 11, color: "var(--bs-secondary-color)", marginTop: 4, fontStyle: "italic" },
  typeGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  typeOption: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px", border: "1px solid var(--bs-border-color)", borderRadius: 8, background: "var(--bs-secondary-bg)", cursor: "pointer" },
  typeOptionSelected: { border: "2px solid var(--bs-primary)", background: "var(--bs-primary-bg-subtle)" },
  actions: { display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" },
  primaryBtn: { background: "var(--bs-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500 },
  secondaryBtn: { background: "none", border: "1px solid var(--bs-border-color)", borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 13, color: "var(--bs-body-color)" },
  errorBanner: { background: "#fee2e2", color: "#991b1b", fontSize: 12, padding: "8px 12px", borderRadius: 6, marginBottom: 12 },
  emailTag: { display: "flex", alignItems: "center", gap: 4, background: "var(--bs-info-bg-subtle)", color: "var(--bs-info-text-emphasis)", padding: "2px 8px", borderRadius: 99, fontSize: 11 },
};


// =============================================================================
// DestinationPicker.jsx
//
// Searchable dropdown for selecting a destination in SkillBuilder.
// Replaces raw webhook URL inputs in skill channel configs.
//
// Props:
//   workspaceId      {number}
//   channelType      {string}  — "slack" | "teams" | "webhook" | "email_group"
//   value            {number|null}  — selected destination_id
//   onChange         {fn(destination_id)}
//   onManageClick    {fn}  — switches UI to Destinations tab
// =============================================================================

export function DestinationPicker({ workspaceId, channelType, value, onChange, onManageClick }) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch(`${API(workspaceId)}/`)
      .then((d) => setDestinations(d.destinations.filter(
        (dest) => dest.is_active && (!channelType || dest.destination_type === channelType)
      )))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId, channelType]);

  const selected = destinations.find((d) => d.id === value);
  const filtered = destinations.filter(
    (d) => !search || d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={pStyles.wrapper}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={pStyles.trigger}
        type="button"
      >
        {selected ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DestHealthDot dest={selected} />
            <span>{selected.name}</span>
            <span style={pStyles.typeLabel}>
              {TYPE_OPTIONS.find((t) => t.value === selected.destination_type)?.label}
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--bs-secondary-color)" }}>
            {loading ? "Loading…" : "Select a destination…"}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div style={pStyles.dropdown}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search destinations…"
            style={pStyles.search}
          />
          {filtered.length === 0 ? (
            <div style={pStyles.empty}>No destinations found.</div>
          ) : (
            filtered.map((dest) => (
              <button
                key={dest.id}
                onClick={() => { onChange(dest.id); setOpen(false); setSearch(""); }}
                style={{ ...pStyles.option, ...(dest.id === value ? pStyles.optionSelected : {}) }}
              >
                <DestHealthDot dest={dest} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{dest.name}</div>
                  {dest.description && (
                    <div style={{ fontSize: 11, color: "var(--bs-secondary-color)" }}>{dest.description}</div>
                  )}
                </div>
                <span style={pStyles.typeLabel}>
                  {TYPE_OPTIONS.find((t) => t.value === dest.destination_type)?.label}
                </span>
              </button>
            ))
          )}
          <div style={pStyles.manageRow}>
            <button onClick={onManageClick} style={pStyles.manageLink}>
              Manage destinations →
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div style={pStyles.statusRow}>
          <DestHealthDot dest={selected} />
          <span style={{ fontSize: 11, color: "var(--bs-secondary-color)" }}>
            {_healthLabel(selected)}
          </span>
        </div>
      )}
    </div>
  );
}

function DestHealthDot({ dest }) {
  const color = !dest.last_test_status ? "#f59e0b"
    : dest.last_test_status === "success" ? "#22c55e"
    : "#ef4444";
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />;
}

function _healthLabel(dest) {
  if (!dest.last_test_status) return "Not yet tested";
  if (dest.last_test_status === "success") return `Healthy · tested ${_ago(dest.last_tested_at)}`;
  return `Test failed · ${dest.last_test_message || "unknown error"}`;
}

function _ago(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const pStyles = {
  wrapper: { position: "relative" },
  trigger: { width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid var(--bs-border-color)", borderRadius: 6, background: "var(--bs-body-bg)", color: "var(--bs-body-color)", cursor: "pointer", fontSize: 13, textAlign: "left" },
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--bs-body-bg)", border: "1px solid var(--bs-border-color)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 200, maxHeight: 280, overflowY: "auto" },
  search: { width: "100%", padding: "8px 10px", border: "none", borderBottom: "1px solid var(--bs-border-color)", background: "transparent", color: "var(--bs-body-color)", fontSize: 13, boxSizing: "border-box", outline: "none" },
  option: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "none", background: "none", cursor: "pointer", textAlign: "left", color: "var(--bs-body-color)" },
  optionSelected: { background: "var(--bs-primary-bg-subtle)" },
  typeLabel: { fontSize: 10, color: "var(--bs-secondary-color)", whiteSpace: "nowrap" },
  empty: { padding: "12px 10px", fontSize: 12, color: "var(--bs-secondary-color)", textAlign: "center" },
  manageRow: { borderTop: "1px solid var(--bs-border-color)", padding: "8px 10px" },
  manageLink: { background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--bs-primary)", padding: 0 },
  statusRow: { display: "flex", alignItems: "center", gap: 5, marginTop: 5 },
};
