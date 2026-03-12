import { useMemo } from "react";
import type { SqlQueryJson } from "../../../../model/sqlJson";
import type { StudioResultTab } from "../model/analysisTypes";

type ResultsPanelProps = {
  activeTab: StudioResultTab;
  onTabChange: (tab: StudioResultTab) => void;
  rows: Array<Record<string, string | number>>;
  sql: string;
  explainText: string;
  sqlJson: SqlQueryJson;
};

export function ResultsPanel(props: ResultsPanelProps) {
  const { activeTab, onTabChange, rows, sql, explainText, sqlJson } = props;

  const headers = useMemo(() => {
    const first = rows[0];
    return first ? Object.keys(first) : [];
  }, [rows]);

  return (
    <div className="analysisResults">
      <div className="analysisResults__tabs">
        <button
          type="button"
          className={activeTab === "results" ? "is-active" : ""}
          onClick={() => onTabChange("results")}
        >
          Results
        </button>
        <button
          type="button"
          className={activeTab === "sql" ? "is-active" : ""}
          onClick={() => onTabChange("sql")}
        >
          SQL
        </button>
        <button
          type="button"
          className={activeTab === "explain" ? "is-active" : ""}
          onClick={() => onTabChange("explain")}
        >
          Explain
        </button>
      </div>

      <div className="analysisResults__body">
        {activeTab === "results" ? (
          headers.length === 0 ? (
            <div className="analysisResults__empty">Select a domain and add steps to preview results.</div>
          ) : (
            <div className="analysisResults__tableWrap">
              <table>
                <thead>
                  <tr>
                    {headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {headers.map((header) => (
                        <td key={`${rowIndex}-${header}`}>{String(row[header] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {activeTab === "sql" ? (
          <div className="analysisResults__sqlView">
            <pre>{sql}</pre>
            <details>
              <summary>sqlJson bridge (stage 1 adapter)</summary>
              <pre>{JSON.stringify(sqlJson, null, 2)}</pre>
            </details>
          </div>
        ) : null}

        {activeTab === "explain" ? (
          <div className="analysisResults__explainView">
            <pre>{explainText}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
