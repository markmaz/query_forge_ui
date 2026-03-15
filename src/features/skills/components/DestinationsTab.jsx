/**
 * DestinationsTab.jsx
 *
 * Workspace destinations management — lives under the Skills section.
 * Admins can create, test, edit, and deactivate destinations.
 * All users can view destinations (names + types + status).
 *
 * Props:
 *   workspaceId  {number}
 *   isAdmin      {boolean}  — from your existing auth context
 */

import { useState, useEffect, useCallback } from "react";
import DestinationForm from "./DestinationForm";

const API = (workspaceId) => `/api/v1/workspaces/${workspaceId}/destinations`;

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

const TYPE_META = {
  slack:       { label: "Slack",             icon: "💬", color: "#4A154B" },
  teams:       { label: "Microsoft Teams",   icon: "🟦", color: "#6264A7" },
  webhook:     { label: "Generic Webhook",   icon: "🔗", color: "#0078d4" },
  email_group: { label: "Email Group",       icon: "✉️",  color: "#c05621" },
};

export default function DestinationsTab({ workspaceId, isAdmin }) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDest, setEditingDest] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`${API(workspaceId)}/`);
      setDestinations(data.destinations);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const handleTest = async (dest) => {
    setTestingId(dest.id);
    setTestResults((prev) => ({ ...prev, [dest.id]: null }));
    try {
      const result = await apiFetch(`${API(workspaceId)}/${dest.id}/test`, { method: "POST" });
      setTestResults((prev) => ({ ...prev, [dest.id]: { success: result.success, message: result.message } }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [dest.id]: { success: false, message: e.message } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeactivate = async (dest) => {
    if (!confirm(`Deactivate "${dest.name}"? Skills using it will stop working.`)) return;
    try {
      await apiFetch(`${API(workspaceId)}/${dest.id}`, { method: "PUT", body: { is_active: false } });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (dest) => {
    if (!confirm(`Delete "${dest.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`${API(workspaceId)}/${dest.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const openEdit = (dest) => { setEditingDest(dest); setShowForm(true); };
  const openCreate = () => { setEditingDest(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingDest(null); load(); };

  if (loading) return <div style={styles.empty}>Loading destinations…</div>;

  return (
    <div style={styles.container}>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div style={styles.toolbar}>
        <div>
          <div style={styles.title}>Destinations</div>
          <div style={styles.subtitle}>
            Configure notification targets once, reuse across all skills.
          </div>
        </div>
        {isAdmin && (
          <button onClick={openCreate} style={styles.primaryBtn}>
            + Add destination
          </button>
        )}
      </div>

      {destinations.length === 0 ? (
        <EmptyState isAdmin={isAdmin} onAdd={openCreate} />
      ) : (
        <DestinationTable
          destinations={destinations}
          isAdmin={isAdmin}
          testingId={testingId}
          testResults={testResults}
          onTest={handleTest}
          onEdit={openEdit}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
        />
      )}

      {showForm && (
        <DestinationFormModal
          workspaceId={workspaceId}
          destination={editingDest}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

// ─── Destination table ─────────────────────────────────────────────────────

function DestinationTable({ destinations, isAdmin, testingId, testResults, onTest, onEdit, onDeactivate, onDelete }) {
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["Name", "Type", "Status", "Last tested", "Used by", ""].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {destinations.map((dest) => (
            <DestinationRow
              key={dest.id}
              dest={dest}
              isAdmin={isAdmin}
              isTesting={testingId === dest.id}
              testResult={testResults[dest.id]}
              onTest={onTest}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DestinationRow({ dest, isAdmin, isTesting, testResult, onTest, onEdit, onDeactivate, onDelete }) {
  const meta = TYPE_META[dest.destination_type] || { label: dest.destination_type, icon: "📡" };
  const usage = dest.usage || {};

  return (
    <>
      <tr style={{ ...styles.tr, opacity: dest.is_active ? 1 : 0.5 }}>
        <td style={styles.td}>
          <div style={styles.destName}>{dest.name}</div>
          {dest.description && <div style={styles.destDesc}>{dest.description}</div>}
        </td>
        <td style={styles.td}>
          <span style={{ ...styles.typeBadge, background: meta.color + "18", color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
        </td>
        <td style={styles.td}>
          <StatusBadge dest={dest} />
        </td>
        <td style={styles.td}>
          <LastTestedCell dest={dest} />
        </td>
        <td style={styles.td}>
          {usage.skills_using_count != null ? (
            <span style={styles.usageCount}>
              {usage.skills_using_count} skill{usage.skills_using_count !== 1 ? "s" : ""}
            </span>
          ) : "—"}
        </td>
        <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
          {isAdmin && (
            <div style={styles.actions}>
              <button
                onClick={() => onTest(dest)}
                disabled={isTesting || !dest.is_active}
                style={styles.actionBtn}
              >
                {isTesting ? "Testing…" : "Test"}
              </button>
              <button onClick={() => onEdit(dest)} style={styles.actionBtn}>Edit</button>
              {dest.is_active ? (
                <button onClick={() => onDeactivate(dest)} style={styles.actionBtn}>Deactivate</button>
              ) : (
                <button
                  onClick={() => onDelete(dest)}
                  disabled={(dest.usage?.skills_using_count || 0) > 0}
                  title={(dest.usage?.skills_using_count || 0) > 0 ? "Used by skills — cannot delete" : ""}
                  style={{ ...styles.actionBtn, color: "#ef4444" }}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {testResult && (
        <tr>
          <td colSpan={6} style={{ padding: "0 12px 8px" }}>
            <div style={{
              ...styles.testResult,
              background: testResult.success ? "#dcfce7" : "#fee2e2",
              color: testResult.success ? "#166534" : "#991b1b",
            }}>
              {testResult.success ? "✓" : "✗"} {testResult.message}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ dest }) {
  if (!dest.is_active) {
    return <span style={{ ...styles.badge, background: "#f1f5f9", color: "#64748b" }}>Inactive</span>;
  }
  if (!dest.last_test_status) {
    return <span style={{ ...styles.badge, background: "#fef9c3", color: "#854d0e" }}>Needs test</span>;
  }
  if (dest.last_test_status === "success") {
    return <span style={{ ...styles.badge, background: "#dcfce7", color: "#166534" }}>Healthy</span>;
  }
  return (
    <span style={{ ...styles.badge, background: "#fee2e2", color: "#991b1b" }} title={dest.last_test_message}>
      Failed
    </span>
  );
}

function LastTestedCell({ dest }) {
  if (!dest.last_tested_at) return <span style={{ color: "var(--bs-secondary-color)", fontSize: 12 }}>Never</span>;
  return (
    <span style={{ fontSize: 12, color: "var(--bs-secondary-color)" }}>
      {_ago(dest.last_tested_at)}
    </span>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ isAdmin, onAdd }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>📡</div>
      <div style={styles.emptyTitle}>No destinations configured</div>
      <div style={styles.emptyText}>
        Destinations are reusable notification targets — Slack channels, Teams webhooks,
        email groups, and more. Configure them once and use them across all your skills.
      </div>
      {isAdmin && (
        <button onClick={onAdd} style={styles.primaryBtn}>Add first destination</button>
      )}
    </div>
  );
}

// ─── Form modal wrapper ────────────────────────────────────────────────────

function DestinationFormModal({ workspaceId, destination, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>
            {destination ? "Edit destination" : "Add destination"}
          </span>
          <button onClick={onClose} style={styles.iconBtn}>✕</button>
        </div>
        <DestinationForm
          workspaceId={workspaceId}
          destination={destination}
          onSaved={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }) {
  return (
    <div style={styles.errorBanner}>
      <span>{message}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b" }}>✕</button>
    </div>
  );
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

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = {
  container: { padding: "16px 0" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, padding: "0 4px" },
  title: { fontWeight: 600, fontSize: 16, marginBottom: 2 },
  subtitle: { fontSize: 12, color: "var(--bs-secondary-color)" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--bs-secondary-color)", borderBottom: "2px solid var(--bs-border-color)", textTransform: "uppercase", letterSpacing: ".4px" },
  tr: { borderBottom: "1px solid var(--bs-border-color)", transition: "background 0.1s" },
  td: { padding: "10px 12px", verticalAlign: "middle" },
  destName: { fontWeight: 500, fontSize: 13 },
  destDesc: { fontSize: 11, color: "var(--bs-secondary-color)", marginTop: 2 },
  typeBadge: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99 },
  badge: { fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99 },
  usageCount: { fontSize: 12, color: "var(--bs-secondary-color)" },
  actions: { display: "flex", gap: 4, justifyContent: "flex-end" },
  actionBtn: { background: "none", border: "1px solid var(--bs-border-color)", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "var(--bs-body-color)" },
  testResult: { fontSize: 12, padding: "6px 10px", borderRadius: 4 },
  emptyState: { textAlign: "center", padding: "48px 24px" },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontWeight: 600, fontSize: 15, marginBottom: 6 },
  emptyText: { fontSize: 13, color: "var(--bs-secondary-color)", maxWidth: 420, margin: "0 auto 20px" },
  empty: { padding: 32, textAlign: "center", color: "var(--bs-secondary-color)" },
  primaryBtn: { background: "var(--bs-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050 },
  modal: { background: "var(--bs-body-bg)", borderRadius: 10, width: 520, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--bs-border-color)" },
  modalTitle: { fontWeight: 600, fontSize: 15 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--bs-secondary-color)" },
  errorBanner: { display: "flex", justifyContent: "space-between", background: "#fee2e2", color: "#991b1b", fontSize: 12, padding: "8px 12px", borderRadius: 6, marginBottom: 12 },
};
