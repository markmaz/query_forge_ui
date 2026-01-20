import React, { useMemo, useState } from "react";

type Props = {
  summary: React.ReactNode;     // your query summary UI
  rows: any[];                  // preview rows
  columns: { key: string; label: string }[]; // for table rendering
  sql: string;                  // compiled sql from backend
};

export const PreviewFlipCard: React.FC<Props> = ({ summary, rows, columns, sql }) => {
  const [showSql, setShowSql] = useState(false);

  const hasRows = rows && rows.length > 0;

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql || "");
    } catch {
      // fallback: do nothing
    }
  };

  return (
    <>
      <style>{`
        .flip-wrap {
          perspective: 1200px;
        }

        .flip-card {
          position: relative;
          width: 100%;
          border-radius: 14px;
          transform-style: preserve-3d;
          transition: transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
          min-height: 320px;
        }

        .flip-card.is-flipped {
          transform: rotateY(180deg);
        }

        .flip-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .flip-face.back {
          transform: rotateY(180deg);
        }

        .flip-header {
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          background: linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.01));
        }

        .flip-title {
          font-weight: 700;
          font-size: 13px;
        }

        .flip-subtle {
          font-size: 12px;
          color: rgba(0,0,0,0.55);
        }

        .flip-body {
          padding: 12px 14px;
          overflow: auto;
          flex: 1 1 auto;
        }

        .sql-box {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          line-height: 1.5;
          white-space: pre;
          background: rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 12px;
          padding: 12px;
          overflow: auto;
        }

        .flip-actions {
          margin-left: auto;
          display: flex;
          gap: 8px;
        }
      `}</style>

      <div className="flip-wrap">
        <div className={`flip-card ${showSql ? "is-flipped" : ""}`}>
          {/* FRONT */}
          <div className="flip-face front">
            <div className="flip-header">
              <div>
                <div className="flip-title">Preview Results</div>
                <div className="flip-subtle">Rows + query summary</div>
              </div>

              <div className="flip-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowSql(true)}
                  title="Show SQL"
                >
                  <i className="fa fa-code me-1" />
                  Show SQL
                </button>
              </div>
            </div>

            <div className="flip-body">
              {/* Summary */}
              <div className="mb-3">{summary}</div>

              {/* Rows */}
              {!hasRows ? (
                <div className="text-muted small">No rows returned.</div>
              ) : (
                <div className="table-responsive border rounded">
                  <table className="table table-sm table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        {columns.map((c) => (
                          <th key={c.key}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          {columns.map((c) => (
                            <td key={c.key}>{String(r?.[c.key] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* BACK */}
          <div className="flip-face back">
            <div className="flip-header">
              <div>
                <div className="flip-title">Compiled SQL</div>
                <div className="flip-subtle">This is what ran in Databricks</div>
              </div>

              <div className="flip-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={copySql}
                  title="Copy SQL"
                >
                  <i className="fa fa-copy me-1" />
                  Copy
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowSql(false)}
                  title="Back to results"
                >
                  <i className="fa fa-rotate-left me-1" />
                  Back
                </button>
              </div>
            </div>

            <div className="flip-body">
              <div className="sql-box">{sql || "-- no sql returned --"}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};