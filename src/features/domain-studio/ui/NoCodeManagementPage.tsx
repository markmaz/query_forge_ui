import React from "react";
import { Outlet } from "react-router-dom";

export const NoCodeManagementPage: React.FC = () => {
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Query Studio Admin</div>
          <div style={{ color: "#666", fontSize: 13 }}>
            Manage domains for the query builder
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <Outlet />
      </div>
    </div>
  );
};

export default NoCodeManagementPage;
