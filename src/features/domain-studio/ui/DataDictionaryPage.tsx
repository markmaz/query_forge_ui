import React from "react";
import { NavLink, Outlet } from "react-router-dom";

const linkStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#333",
  fontSize: 13,
};

const activeStyle: React.CSSProperties = {
  ...linkStyle,
  background: "#eef4ff",
  border: "1px solid #cfe0ff",
};

export const DataDictionaryPage: React.FC = () => {
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Data Dictionary</div>
          <div style={{ color: "#666", fontSize: 13 }}>
            Upload dictionaries • reconcile drift
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <NavLink to="" end style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>
          Dictionary
        </NavLink>
        <NavLink to="reconcile" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>
          Reconcile
        </NavLink>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <Outlet />
      </div>
    </div>
  );
};

export default DataDictionaryPage;
