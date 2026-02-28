// src/features/query-forge/ui/components/home/WelcomeBanner.tsx
import React from "react";

export type WelcomeBannerProps = {
  userDisplayName?: string | null;
  workspaceName?: string | null;
  subtitle?: string;
  badges?: Array<{ label: string; tone?: "primary" | "secondary" | "success" | "warning" | "danger" }>;
  onOpenDocs?: () => void;
};

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  userDisplayName,
  workspaceName,
  subtitle = "Build, refine, and preview analytics queries without writing SQL — or drop down to SQL when you need it.",
  badges = [{ label: "Databricks", tone: "secondary" }, { label: "Delta", tone: "secondary" }, { label: "SQL Warehouse", tone: "secondary" }],
  onOpenDocs,
}) => {
  return (
    <div className="card shadow-sm">
      <div className="card-body d-flex flex-column flex-md-row gap-3 align-items-start align-items-md-center justify-content-between">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h4 className="mb-0">Welcome{userDisplayName ? `, ${userDisplayName}` : ""}</h4>
            {workspaceName ? <span className="badge text-bg-light border">{workspaceName}</span> : null}
          </div>
          <div className="text-muted mt-1">{subtitle}</div>

          <div className="d-flex gap-2 flex-wrap mt-3">
            {badges.map((b, idx) => (
              <span key={idx} className={`badge text-bg-${b.tone ?? "secondary"}`}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={onOpenDocs}>
            Learn more
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;