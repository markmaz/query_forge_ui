/**
 * QueryAnalysisPanel.jsx  (v2 — addresses race conditions, reopen behavior)
 *
 * Inline AI analysis panel for the Query Studio.
 * Renders ABOVE the results table when the user clicks "Analyze".
 *
 * Props:
 *   queryId       {number}
 *   workspaceId   {number}
 *   results       {Array}   — current query result rows (for hash + reopen)
 *   rowCount      {number}  — total row count
 *   onClose       {fn}
 *
 * Race condition handling:
 *   Uses a request counter (reqId). Responses where reqId doesn't match
 *   the current counter are silently dropped. This prevents stale
 *   responses from a previous analysis overwriting a newer one.
 *
 * Reopen behavior:
 *   The panel stores the last result_hash returned by the server.
 *   On reopen, it sends that hash with the request, allowing a fast
 *   cache hit if the results haven't changed.
 *
 * Reset behavior:
 *   The parent component should reset showAnalysis=false and clear
 *   the stored hash when the query is re-run. The panel itself does
 *   not watch for query re-runs — that is the parent's responsibility.
 *
 * Usage in Query Studio:
 *   {showAnalysis && (
 *     <QueryAnalysisPanel
 *       queryId={query.id}
 *       workspaceId={workspaceId}
 *       results={results}
 *       rowCount={rowCount}
 *       onClose={() => setShowAnalysis(false)}
 *     />
 *   )}
 *
 *   // Reset when query re-runs:
 *   const handleExecute = () => {
 *     setShowAnalysis(false);  // close panel + clear stored hash
 *     runQuery();
 *   };
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getAccessToken } from "@/shared/runtime/accessTokenStore";

// ---------------------------------------------------------------------------
// Hash utility (mirrors server-side result_hash in analysis_utils.py)
// ---------------------------------------------------------------------------

async function computeResultHash(rows, rowCount) {
  try {
    const sample = rows.slice(0, 50);
    const payload = JSON.stringify({ row_count: rowCount, sample });
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  } catch {
    return ""; // fallback: no hash, cache hint skipped
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function QueryAnalysisPanel({
  queryId,
  workspaceId,
  results = [],
  rowCount = 0,
  queryName = "Query",
  onClose,
}) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [promptHint, setPromptHint] = useState("");
  const [showHintInput, setShowHintInput] = useState(false);
  const [cached, setCached] = useState(false);

  // Race condition guard: track current request ID
  const reqCounterRef = useRef(0);

  // Persist last known result hash for reopen fast-path
  const lastHashRef = useRef("");

  const analyze = useCallback(
    async (hint = "") => {
      // Increment request counter — responses with stale IDs will be dropped
      const myReqId = ++reqCounterRef.current;

      setState("loading");
      setError(null);
      setAnalysis(null);

      try {
        const hash =
          lastHashRef.current || (await computeResultHash(results, rowCount));

        const token = getAccessToken();
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(workspaceId != null
            ? { "X-Workspace-Id": String(workspaceId) }
            : {}),
        };

        let res;
        if (queryId) {
          // Saved query — backend re-executes for full dataset
          res = await fetch(`/api/v1/queries/${queryId}/analyze`, {
            method: "POST",
            headers,
            body: JSON.stringify({ prompt_hint: hint, result_hash: hash }),
          });
        } else {
          // Unsaved/draft query — send current rows inline
          const columnNames = results.length > 0 ? Object.keys(results[0]) : [];
          res = await fetch(`/api/v1/queries/analyze`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              prompt_hint: hint,
              result_hash: hash,
              rows: results,
              column_names: columnNames,
              row_count: rowCount,
              query_name: queryName,
            }),
          });
        }

        // Drop stale response if a newer request was made while this was in flight
        if (myReqId !== reqCounterRef.current) return;

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Analysis failed.");
          setState("error");
          return;
        }

        // Store canonical hash from server for reopen fast-path
        if (data.result_hash) {
          lastHashRef.current = data.result_hash;
        }

        setAnalysis(data);
        setCached(data.cached || false);
        setState("done");
      } catch (e) {
        if (myReqId !== reqCounterRef.current) return;
        setError("Could not reach the analysis service.");
        setState("error");
      }
    },
    [queryId, results, rowCount, queryName],
  );

  // Auto-run on mount
  useEffect(() => {
    analyze();
  }, [analyze]);

  return (
    <div style={styles.panel}>
      <PanelHeader
        state={state}
        cached={cached}
        onClose={onClose}
        onRerun={() => {
          lastHashRef.current = ""; // clear hash to force fresh analysis on rerun
          analyze(promptHint);
        }}
        onToggleHint={() => setShowHintInput((v) => !v)}
        showHintInput={showHintInput}
      />

      {showHintInput && (
        <HintInput
          value={promptHint}
          onChange={setPromptHint}
          onSubmit={() => {
            lastHashRef.current = ""; // new hint = new analysis, skip cache
            analyze(promptHint);
          }}
          disabled={state === "loading"}
        />
      )}

      <div style={styles.body}>
        {state === "loading" && <LoadingState />}
        {state === "error" && (
          <ErrorState message={error} onRetry={() => analyze(promptHint)} />
        )}
        {state === "done" && analysis && <AnalysisResult analysis={analysis} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PanelHeader({
  state,
  cached,
  onClose,
  onRerun,
  onToggleHint,
  showHintInput,
}) {
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.sparkle}>✨</span>
        <span style={styles.headerTitle}>AI Analysis</span>
        {cached && state === "done" && (
          <span style={styles.cachedBadge}>cached</span>
        )}
        {state === "loading" && (
          <span style={styles.analyzingBadge}>analyzing…</span>
        )}
      </div>
      <div style={styles.headerActions}>
        <button
          onClick={onToggleHint}
          title="Add guidance for the analysis"
          style={{
            ...styles.headerBtn,
            ...(showHintInput ? styles.headerBtnActive : {}),
          }}
        >
          Guide
        </button>
        {state === "done" && (
          <button
            onClick={onRerun}
            style={styles.headerBtn}
            title="Re-run analysis"
          >
            ↺ Rerun
          </button>
        )}
        <button onClick={onClose} style={styles.closeBtn} title="Close">
          ✕
        </button>
      </div>
    </div>
  );
}

function HintInput({ value, onChange, onSubmit, disabled }) {
  return (
    <div style={styles.hintRow}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !disabled && onSubmit()}
        placeholder="Guide the analysis — e.g. 'Focus on revenue anomalies' or 'Check for data quality issues'"
        style={styles.hintInput}
        disabled={disabled}
        autoFocus
      />
      <button
        onClick={onSubmit}
        disabled={disabled}
        style={styles.hintSubmitBtn}
      >
        Analyze
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={styles.loadingContainer}>
      <LoadingDots />
      <span style={styles.loadingText}>Analyzing your results…</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ ...styles.dot, animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={styles.errorState}>
      <span style={styles.errorIcon}>⚠</span>
      <span style={styles.errorText}>{message}</span>
      <button onClick={onRetry} style={styles.retryBtn}>
        Try again
      </button>
    </div>
  );
}

function AnalysisResult({ analysis }) {
  return (
    <div style={styles.result}>
      {analysis.highlights?.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Highlights</div>
          <ul style={styles.highlightList}>
            {analysis.highlights.map((h, i) => (
              <li key={i} style={styles.highlightItem}>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.narrative && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Summary</div>
          {analysis.narrative
            .split("\n\n")
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} style={styles.narrativePara}>
                {para}
              </p>
            ))}
        </div>
      )}

      <div style={styles.footer}>
        <span style={styles.footerMeta}>
          {analysis.row_count?.toLocaleString()} rows
          {analysis.sampled_rows && analysis.sampled_rows < analysis.row_count
            ? ` · ${analysis.sampled_rows} sampled`
            : ""}
          {analysis.cached ? " · from cache" : ""}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  panel: {
    background: "var(--bs-secondary-bg)",
    border: "1px solid var(--bs-border-color)",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    fontFamily: "var(--bs-font-sans-serif)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 14px",
    borderBottom: "1px solid var(--bs-border-color)",
    background: "var(--bs-body-bg)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 6 },
  sparkle: { fontSize: 14 },
  headerTitle: { fontWeight: 600, fontSize: 13 },
  cachedBadge: {
    fontSize: 10,
    background: "var(--bs-secondary-bg)",
    color: "var(--bs-secondary-color)",
    padding: "1px 6px",
    borderRadius: 99,
    border: "1px solid var(--bs-border-color)",
  },
  analyzingBadge: {
    fontSize: 10,
    color: "var(--bs-primary)",
    fontStyle: "italic",
  },
  headerActions: { display: "flex", gap: 4, alignItems: "center" },
  headerBtn: {
    background: "none",
    border: "1px solid var(--bs-border-color)",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    cursor: "pointer",
    color: "var(--bs-secondary-color)",
  },
  headerBtnActive: {
    background: "var(--bs-primary-bg-subtle)",
    borderColor: "var(--bs-primary)",
    color: "var(--bs-primary)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--bs-secondary-color)",
    padding: "0 4px",
    lineHeight: 1,
  },
  hintRow: {
    display: "flex",
    gap: 6,
    padding: "8px 14px",
    borderBottom: "1px solid var(--bs-border-color)",
    background: "var(--bs-primary-bg-subtle)",
  },
  hintInput: {
    flex: 1,
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid var(--bs-border-color)",
    background: "var(--bs-body-bg)",
    color: "var(--bs-body-color)",
    fontSize: 12,
  },
  hintSubmitBtn: {
    background: "var(--bs-primary)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "5px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  body: { padding: "12px 14px" },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
  },
  loadingText: {
    fontSize: 12,
    color: "var(--bs-secondary-color)",
    fontStyle: "italic",
  },
  dots: { display: "flex", gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--bs-primary)",
    animation: "qaPulse 1s ease-in-out infinite",
    display: "inline-block",
  },
  errorState: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
  },
  errorIcon: { fontSize: 14, color: "#f59e0b" },
  errorText: { fontSize: 12, color: "var(--bs-secondary-color)", flex: 1 },
  retryBtn: {
    background: "none",
    border: "1px solid var(--bs-border-color)",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    cursor: "pointer",
    color: "var(--bs-body-color)",
  },
  result: { display: "flex", flexDirection: "column", gap: 14 },
  section: {},
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "var(--bs-secondary-color)",
    marginBottom: 6,
  },
  highlightList: {
    margin: 0,
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  highlightItem: { fontSize: 13, lineHeight: 1.5 },
  narrativePara: {
    fontSize: 13,
    lineHeight: 1.6,
    margin: "0 0 8px",
    color: "var(--bs-body-color)",
  },
  footer: {
    borderTop: "1px solid var(--bs-border-color)",
    paddingTop: 8,
    marginTop: 4,
  },
  footerMeta: { fontSize: 11, color: "var(--bs-secondary-color)" },
};

if (typeof document !== "undefined") {
  const styleId = "qa-panel-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `@keyframes qaPulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`;
    document.head.appendChild(style);
  }
}
