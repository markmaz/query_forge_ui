import React from "react";
import { NavLink } from "react-router-dom";

type Props = {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const links = [
  { to: "/semantic/concepts", label: "Concepts" },
  { to: "/semantic/aliases", label: "Aliases" },
  { to: "/semantic/value-aliases", label: "Value Aliases" },
  { to: "/admin/semantic/relationships", label: "Relationships" },
  { to: "/semantic/planner", label: "Planner" },
];

export function SemanticAdminShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="semantic-admin-page">
      <div className="semantic-admin-header">
        <div>
          <h1>{title}</h1>
          <p className="semantic-admin-subtitle">{subtitle}</p>
        </div>
        {actions}
      </div>

      <nav className="semantic-admin-nav" aria-label="Semantic admin navigation">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => `semantic-admin-nav-link${isActive ? " active" : ""}`}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {children}
    </div>
  );
}

export default SemanticAdminShell;
