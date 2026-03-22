import React from "react";
import { Outlet } from "react-router-dom";
import "../../query-forge/ui/styles/queryForgeHero.css";

export const NoCodeManagementPage: React.FC = () => {
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <header className="qf-hero mb-3">
        <div className="qf-hero-main">
          <h1 className="qf-hero-title">Domain Studio</h1>
          <p className="qf-hero-subtitle mb-0">
            Create domains, use AI suggestions, and design domain structure visually for Query Studio.
          </p>
        </div>
      </header>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <Outlet />
      </div>
    </div>
  );
};

export default NoCodeManagementPage;
