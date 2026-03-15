import { useState } from "react";
import type { FormEvent } from "react";
import { getAccessToken } from "../../../../../../../shared/runtime/accessTokenStore";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface SkillBuilderProps {
  queryId?: string | null;
  workspaceId?: string | null;
}

interface SkillFormValues {
  name: string;
  recipients: string;
  subject: string;
  reply_to: string;
  include_summary: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; skillId: string }
  | { kind: "running"; skillId: string }
  | { kind: "done"; skillId: string }
  | { kind: "error"; message: string };

const DEFAULT_FORM: SkillFormValues = {
  name: "",
  recipients: "",
  subject: "QueryForge Report",
  reply_to: "",
  include_summary: true,
};

function resolveWorkspaceId(prop: string | null | undefined): string | null {
  if (prop) return prop;
  const fromStorage =
    localStorage.getItem("workspaceId") ?? localStorage.getItem("workspace_id");
  return fromStorage && fromStorage.trim() ? fromStorage.trim() : null;
}

function buildHeaders(workspaceId: string | null | undefined): HeadersInit {
  const token = getAccessToken();
  const resolvedWorkspaceId = resolveWorkspaceId(workspaceId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (resolvedWorkspaceId) {
    headers["X-Workspace-Id"] = resolvedWorkspaceId;
  }
  return headers;
}

export function SkillBuilder({ queryId, workspaceId }: SkillBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<SkillFormValues>(DEFAULT_FORM);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const savedSkillId =
    status.kind === "saved" ||
    status.kind === "running" ||
    status.kind === "done"
      ? status.skillId
      : null;

  const isBusy = status.kind === "saving" || status.kind === "running";

  const handleChange = (
    field: keyof SkillFormValues,
    value: string | boolean,
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (status.kind === "error") {
      setStatus({ kind: "idle" });
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;

    const recipientList = form.recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (!form.name.trim()) {
      setStatus({ kind: "error", message: "Skill name is required." });
      return;
    }

    if (recipientList.length === 0) {
      setStatus({
        kind: "error",
        message: "At least one recipient email is required.",
      });
      return;
    }

    setStatus({ kind: "saving" });

    try {
      const body = {
        name: form.name.trim(),
        skill_type: "email_delivery",
        query_id: queryId ?? null,
        config: {
          recipients: recipientList,
          subject: form.subject.trim() || "QueryForge Report",
          reply_to: form.reply_to.trim() || null,
          include_summary: form.include_summary,
        },
      };

      const response = await fetch(`${API_URL}/skills`, {
        method: "POST",
        headers: buildHeaders(workspaceId),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMessage = `Save failed (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText) as {
            message?: string;
            error?: string;
          };
          errorMessage = errorJson.message ?? errorJson.error ?? errorMessage;
        } catch {
          // use default error message
        }
        setStatus({ kind: "error", message: errorMessage });
        return;
      }

      const envelope = (await response.json()) as {
        id?: string;
        skill_id?: string;
        data?: { id?: string; skill_id?: string };
      };
      const inner = envelope.data ?? envelope;
      const skillId = inner.id ?? inner.skill_id ?? "";
      setStatus({ kind: "saved", skillId });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error saving skill.";
      setStatus({ kind: "error", message });
    }
  };

  const handleRunNow = async () => {
    const skillId = savedSkillId;
    if (!skillId || isBusy) return;

    setStatus({ kind: "running", skillId });

    try {
      const response = await fetch(`${API_URL}/skills/${skillId}/execute`, {
        method: "POST",
        headers: buildHeaders(workspaceId),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMessage = `Execution failed (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText) as {
            message?: string;
            error?: string;
          };
          errorMessage = errorJson.message ?? errorJson.error ?? errorMessage;
        } catch {
          // use default error message
        }
        setStatus({ kind: "error", message: errorMessage });
        return;
      }

      setStatus({ kind: "done", skillId });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error running skill.";
      setStatus({ kind: "error", message });
    }
  };

  return (
    <section
      style={{
        margin: "12px 14px 0",
        border: "1px solid #d7deea",
        borderRadius: 14,
        background: "#ffffff",
        boxShadow: "0 12px 28px rgba(18, 23, 37, 0.06)",
        overflow: "hidden",
      }}
      aria-label="Skills"
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        style={{
          width: "100%",
          border: 0,
          background: isOpen ? "#f9fbff" : "#ffffff",
          borderBottom: isOpen ? "1px solid #d7deea" : "none",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={isOpen}
        aria-controls="skill-builder-panel"
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontWeight: 700,
            fontSize: "0.88rem",
            color: "#131722",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "1rem" }}>
            ⚡
          </span>
          Skills
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: "0.72rem",
            color: "#5f6b82",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>

      {/* Collapsible panel */}
      {isOpen && (
        <div id="skill-builder-panel" style={{ padding: "14px 16px 16px" }}>
          <form
            onSubmit={(event) => {
              void handleSave(event);
            }}
            noValidate
          >
            <div style={{ display: "grid", gap: 10 }}>
              {/* Name */}
              <label className="analysisField" htmlFor="skill-builder-name">
                <span>
                  Skill name{" "}
                  <span aria-hidden="true" style={{ color: "#c73a32" }}>
                    *
                  </span>
                </span>
                <input
                  id="skill-builder-name"
                  type="text"
                  required
                  placeholder="e.g. Weekly Sales Report"
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  disabled={isBusy}
                  aria-required="true"
                />
              </label>

              {/* Recipients */}
              <label
                className="analysisField"
                htmlFor="skill-builder-recipients"
              >
                <span>
                  Recipients{" "}
                  <span style={{ color: "#5f6b82", fontWeight: 400 }}>
                    (comma-separated emails)
                  </span>{" "}
                  <span aria-hidden="true" style={{ color: "#c73a32" }}>
                    *
                  </span>
                </span>
                <textarea
                  id="skill-builder-recipients"
                  rows={2}
                  placeholder="alice@example.com, bob@example.com"
                  value={form.recipients}
                  onChange={(event) =>
                    handleChange("recipients", event.target.value)
                  }
                  disabled={isBusy}
                  aria-required="true"
                  style={{ minHeight: 60 }}
                />
              </label>

              {/* Subject */}
              <label className="analysisField" htmlFor="skill-builder-subject">
                <span>Email subject</span>
                <input
                  id="skill-builder-subject"
                  type="text"
                  placeholder="QueryForge Report"
                  value={form.subject}
                  onChange={(event) =>
                    handleChange("subject", event.target.value)
                  }
                  disabled={isBusy}
                />
              </label>

              {/* Reply-to */}
              <label className="analysisField" htmlFor="skill-builder-reply-to">
                <span>
                  Reply-to{" "}
                  <span style={{ color: "#5f6b82", fontWeight: 400 }}>
                    (optional)
                  </span>
                </span>
                <input
                  id="skill-builder-reply-to"
                  type="email"
                  placeholder="noreply@example.com"
                  value={form.reply_to}
                  onChange={(event) =>
                    handleChange("reply_to", event.target.value)
                  }
                  disabled={isBusy}
                />
              </label>

              {/* Include summary checkbox */}
              <label
                htmlFor="skill-builder-include-summary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.82rem",
                  color: "#131722",
                  cursor: isBusy ? "not-allowed" : "pointer",
                }}
              >
                <input
                  id="skill-builder-include-summary"
                  type="checkbox"
                  checked={form.include_summary}
                  onChange={(event) =>
                    handleChange("include_summary", event.target.checked)
                  }
                  disabled={isBusy}
                  style={{
                    width: "auto",
                    cursor: isBusy ? "not-allowed" : "pointer",
                  }}
                />
                Include AI summary in email body
              </label>

              {/* Status message */}
              {status.kind !== "idle" &&
                status.kind !== "saving" &&
                status.kind !== "running" && (
                  <p
                    role="status"
                    aria-live="polite"
                    style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color:
                        status.kind === "error"
                          ? "#c73a32"
                          : status.kind === "done"
                            ? "#1a7a44"
                            : "#5f6b82",
                      background:
                        status.kind === "error"
                          ? "#fff5f5"
                          : status.kind === "done"
                            ? "#f0fff6"
                            : "#f9fbff",
                      border: `1px solid ${
                        status.kind === "error"
                          ? "#f3bcbc"
                          : status.kind === "done"
                            ? "#a3d9b8"
                            : "#d7deea"
                      }`,
                      borderRadius: 8,
                      padding: "7px 10px",
                    }}
                  >
                    {status.kind === "error" && status.message}
                    {status.kind === "saved" && "Skill saved successfully."}
                    {status.kind === "done" &&
                      "Skill executed — delivery queued."}
                  </p>
                )}

              {(status.kind === "saving" || status.kind === "running") && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    margin: 0,
                    fontSize: "0.8rem",
                    color: "#5f6b82",
                    background: "#f9fbff",
                    border: "1px solid #d7deea",
                    borderRadius: 8,
                    padding: "7px 10px",
                  }}
                >
                  {status.kind === "saving" ? "Saving…" : "Running…"}
                </p>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                <button
                  type="submit"
                  disabled={isBusy}
                  style={{
                    flex: "0 0 auto",
                    border: "1px solid transparent",
                    borderRadius: 10,
                    background: "#ff6a13",
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    padding: "8px 14px",
                    cursor: isBusy ? "not-allowed" : "pointer",
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  Save Skill
                </button>

                {savedSkillId && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleRunNow();
                    }}
                    disabled={isBusy}
                    style={{
                      flex: "0 0 auto",
                      border: "1px solid #d7deea",
                      borderRadius: 10,
                      background: "#f9fbff",
                      color: "#131722",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      padding: "8px 14px",
                      cursor: isBusy ? "not-allowed" : "pointer",
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    Run Now
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
