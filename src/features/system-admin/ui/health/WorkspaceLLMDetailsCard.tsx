import type { WorkspaceLLMHealthCheck, WorkspaceLLMHealthItem } from "@/features/system-admin/types";

interface WorkspaceLLMDetailsCardProps {
  check: WorkspaceLLMHealthCheck;
}

function statusLabel(llm: WorkspaceLLMHealthItem): string {
  if (!llm.active) {
    return "Inactive";
  }
  return llm.status === "ok" ? "OK" : "Error";
}

function providerLabel(llm: WorkspaceLLMHealthItem): string {
  return [llm.provider, llm.model].filter(Boolean).join(" / ") || "-";
}

export default function WorkspaceLLMDetailsCard({ check }: WorkspaceLLMDetailsCardProps) {
  const activeLlms = check.llms?.filter((llm) => llm.active) ?? [];
  const displayedLlms = activeLlms.length ? activeLlms : check.llms ?? [];

  return (
    <div className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">
          <i className="fa fa-comments" style={{ marginRight: 8 }} />
          LLM Details
        </h3>
        <span className="sa-card-status ok">
          <i className="fa fa-info-circle" />
          Info
        </span>
      </div>

      <div className="sa-card-body">
        {displayedLlms.length ? (
          <div className="sa-card-inset">
            <div className="sa-llm-detail-list">
              {displayedLlms.map((llm) => (
                <div
                  className={`sa-llm-detail-row ${llm.status === "error" && llm.active ? "is-error" : ""}`}
                  key={`${llm.id ?? llm.name}-${llm.role}`}
                >
                  <div className="sa-llm-detail-main">
                    <strong>{llm.name}</strong>
                    <span>{llm.role}</span>
                  </div>
                  <div className="sa-llm-detail-meta">
                    <span>{providerLabel(llm)}</span>
                    {llm.endpoint ? <span>{llm.endpoint}</span> : null}
                  </div>
                  <div className="sa-llm-detail-footer">
                    <span className={`sa-inline-status ${llm.status === "ok" || !llm.active ? "ok" : "error"}`}>
                      {statusLabel(llm)}
                    </span>
                    {llm.latency_ms != null ? <span>{llm.latency_ms} ms</span> : null}
                    {llm.message ? <span>{llm.message}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="sa-card-inset">No workspace LLMs are configured.</div>
        )}
      </div>
    </div>
  );
}
