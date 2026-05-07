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
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { getAccessToken } from "@/shared/runtime/accessTokenStore";
import DestinationForm from "./DestinationForm";

const API = (workspaceId) => `/api/v1/workspaces/${workspaceId}/destinations`;

async function apiFetch(url, opts = {}) {
  const token = getAccessToken();
  const wsMatch = url.match(/\/workspaces\/([^/]+)\//);
  const workspaceId = wsMatch ? wsMatch[1] : null;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || data.message || "API error");
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function normalizeDestinationsPayload(payload) {
  if (Array.isArray(payload?.destinations)) return payload.destinations;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function mergeDestinationUpdate(destinations, destinationId, patch) {
  return destinations.map((dest) =>
    dest.id === destinationId ? { ...dest, ...patch } : dest,
  );
}

const TYPE_META = {
  slack: { label: "Slack", icon: "fa-brands fa-slack", color: "#4A154B" },
  teams: { label: "Microsoft Teams", icon: "fa-brands fa-microsoft", color: "#6264A7" },
  webhook: { label: "Generic Webhook", icon: "fa fa-link", color: "#0078d4" },
  email_group: { label: "Email Group", icon: "fa fa-envelope", color: "#c05621" },
};

export default function DestinationsTab({ workspaceId, isAdmin }) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDest, setEditingDest] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`${API(workspaceId)}/`);
      setDestinations(normalizeDestinationsPayload(data));
    } catch (e) {
      if (e?.status === 404) {
        setDestinations([]);
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTest = async (dest) => {
    setTestingId(dest.id);
    setTestResults((prev) => ({ ...prev, [dest.id]: null }));
    try {
      const result = await apiFetch(`${API(workspaceId)}/${dest.id}/test`, {
        method: "POST",
      });
      setDestinations((prev) =>
        mergeDestinationUpdate(prev, dest.id, {
          last_tested_at: result.last_tested_at,
          last_test_status: result.success ? "success" : "failed",
          last_test_message: result.success ? null : result.message,
        }),
      );
      setTestResults((prev) => ({
        ...prev,
        [dest.id]: { success: result.success, message: result.message },
      }));
    } catch (e) {
      const failureMessage = e.message;
      const lastTestedAt = e?.data?.last_tested_at ?? new Date().toISOString();
      setDestinations((prev) =>
        mergeDestinationUpdate(prev, dest.id, {
          last_tested_at: lastTestedAt,
          last_test_status: "failed",
          last_test_message: failureMessage,
        }),
      );
      setTestResults((prev) => ({
        ...prev,
        [dest.id]: { success: false, message: failureMessage },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeactivate = async (dest) => {
    setConfirmAction({ type: "deactivate", destination: dest });
  };

  const handleDelete = async (dest) => {
    setConfirmAction({ type: "delete", destination: dest });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const dest = confirmAction.destination;
    try {
      if (confirmAction.type === "deactivate") {
        await apiFetch(`${API(workspaceId)}/${dest.id}`, {
          method: "PUT",
          body: { is_active: false },
        });
      } else {
        await apiFetch(`${API(workspaceId)}/${dest.id}`, { method: "DELETE" });
      }
      setConfirmAction(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const openEdit = (dest) => {
    if (!isAdmin) return;
    setEditingDest(dest);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingDest(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDest(null);
    load();
  };

  if (loading) return <div className="skills-destinations-empty">Loading destinations…</div>;

  return (
    <div className="skills-destinations">
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      <div className="skills-destinations__toolbar">
        <div>
          <div className="skills-destinations__title">Destinations</div>
          <div className="skills-destinations__subtitle">
            Configure notification targets once, reuse across all skills.
          </div>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn btn-primary btn-sm">
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
        <DestinationFormDrawer
          workspaceId={workspaceId}
          destination={editingDest}
          onClose={closeForm}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "delete" ? "Delete destination" : "Deactivate destination"}
        message={
          confirmAction?.type === "delete"
            ? `Delete "${confirmAction.destination.name}"? This cannot be undone.`
            : `Deactivate "${confirmAction?.destination.name ?? ""}"? Skills using it will stop working.`
        }
        confirmLabel={confirmAction?.type === "delete" ? "Delete destination" : "Deactivate destination"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

function DestinationTable({
  destinations,
  isAdmin,
  testingId,
  testResults,
  onTest,
  onEdit,
  onDeactivate,
  onDelete,
}) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="table-responsive">
        <table className="table align-middle mb-0 skills-destinations-table">
          <thead>
            <tr>
              {["Name", "Type", "Status", "Last tested", "Used by", ""].map((header) => (
                <th key={header}>{header}</th>
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
    </div>
  );
}

function DestinationRow({
  dest,
  isAdmin,
  isTesting,
  testResult,
  onTest,
  onEdit,
  onDeactivate,
  onDelete,
}) {
  const meta = TYPE_META[dest.destination_type] || {
    label: dest.destination_type,
    icon: "fa fa-satellite-dish",
    color: "#475569",
  };
  const usage = dest.usage || {};
  const canDelete = !dest.is_active;
  const rowClassName = [
    "skills-destinations-table__row",
    !dest.is_active ? "is-inactive" : "",
    isAdmin ? "is-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleRowClick = () => {
    if (isAdmin) onEdit(dest);
  };

  const handleRowKeyDown = (event) => {
    if (!isAdmin) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit(dest);
    }
  };

  const stopRowClick = (event) => {
    event.stopPropagation();
  };

  return (
    <>
      <tr
        className={rowClassName}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        role={isAdmin ? "button" : undefined}
        tabIndex={isAdmin ? 0 : undefined}
      >
        <td>
          <div className="skills-destinations-table__name">{dest.name}</div>
          {dest.description && (
            <div className="skills-destinations-table__description">
              {dest.description}
            </div>
          )}
        </td>
        <td>
          <span
            className="skills-destinations-table__type-badge"
            style={{
              backgroundColor: `${meta.color}18`,
              color: meta.color,
            }}
          >
            <i className={meta.icon} aria-hidden="true" />
            <span>{meta.label}</span>
          </span>
        </td>
        <td>
          <StatusBadge dest={dest} />
        </td>
        <td>
          <LastTestedCell dest={dest} />
        </td>
        <td>
          {usage.skills_using_count != null ? (
            <span className="skills-destinations-table__usage">
              {usage.skills_using_count} skill
              {usage.skills_using_count !== 1 ? "s" : ""}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="text-end">
          {isAdmin && (
            <div className="skills-destinations-table__actions" onClick={stopRowClick}>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => onTest(dest)}
                disabled={isTesting || !dest.is_active}
                aria-label={isTesting ? "Testing destination" : "Test destination"}
                title={isTesting ? "Testing…" : "Test destination"}
              >
                <i
                  className={isTesting ? "fa fa-spinner fa-spin" : "fa fa-flask"}
                  aria-hidden="true"
                />
              </button>
              {dest.is_active ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onDeactivate(dest)}
                  aria-label="Deactivate destination"
                  title="Deactivate destination"
                >
                  <i className="fa fa-ban" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onDelete(dest)}
                  disabled={(dest.usage?.skills_using_count || 0) > 0}
                  aria-label="Delete destination"
                  title={
                    (dest.usage?.skills_using_count || 0) > 0
                      ? "Used by skills — cannot delete"
                      : "Delete destination"
                  }
                >
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {testResult && (
        <tr className="skills-destinations-table__feedback-row">
          <td colSpan={6}>
            <div
              className={
                testResult.success
                  ? "skills-destinations-table__feedback is-success"
                  : "skills-destinations-table__feedback is-error"
              }
            >
              {testResult.success ? "✓" : "✗"} {testResult.message}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ dest }) {
  if (!dest.is_active) {
    return <span className="skills-destinations-table__status is-inactive">Inactive</span>;
  }
  if (!dest.last_test_status) {
    return <span className="skills-destinations-table__status is-pending">Needs test</span>;
  }
  if (dest.last_test_status === "success") {
    return <span className="skills-destinations-table__status is-success">Healthy</span>;
  }
  return (
    <span
      className="skills-destinations-table__status is-error"
      title={dest.last_test_message ?? ""}
    >
      Failed
    </span>
  );
}

function LastTestedCell({ dest }) {
  if (!dest.last_tested_at) {
    return (
      <span className="skills-destinations-table__muted">
        Never
      </span>
    );
  }
  return (
    <span className="skills-destinations-table__muted">
      {_ago(dest.last_tested_at)}
    </span>
  );
}

function EmptyState({ isAdmin, onAdd }) {
  return (
    <div className="skills-destinations-empty-state">
      <div className="skills-destinations-empty-state__icon">📡</div>
      <div className="skills-destinations-empty-state__title">No destinations configured</div>
      <div className="skills-destinations-empty-state__text">
        Destinations are reusable notification targets — Slack channels, Teams
        webhooks, email groups, and more. Configure them once and use them
        across all your skills.
      </div>
      {isAdmin && (
        <button onClick={onAdd} className="btn btn-primary btn-sm">
          Add first destination
        </button>
      )}
    </div>
  );
}

function DestinationFormDrawer({ workspaceId, destination, onClose }) {
  return (
    <>
      <div className="skills-drawer-backdrop" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={destination ? "Edit destination" : "Add destination"}
        className="skills-destinations-drawer"
      >
        <div className="skills-destinations-drawer__header">
          <span className="skills-destinations-drawer__title">
            {destination ? "Edit destination" : "Add destination"}
          </span>
          <button onClick={onClose} className="skills-destinations-drawer__close" type="button">
            ✕
          </button>
        </div>
        <div className="skills-destinations-drawer__body">
          <DestinationForm
            workspaceId={workspaceId}
            destination={destination}
            onSaved={onClose}
            onCancel={onClose}
          />
        </div>
      </aside>
    </>
  );
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="skills-destinations-error">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="skills-destinations-error__dismiss">
        ✕
      </button>
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
