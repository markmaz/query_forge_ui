import React from "react";
import { NavLink } from "react-router-dom";
import { routes } from "@/app/navigation/routes";

type Props = {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const links = [
  { to: routes.SemanticConcepts, label: "Concepts" },
  { to: routes.SemanticAliases, label: "Aliases" },
  { to: routes.SemanticValueAliases, label: "Value Aliases" },
  { to: routes.SemanticConceptColumnMaps, label: "Column Maps" },
  { to: routes.SemanticReadiness, label: "Readiness" },
  { to: routes.AdminSemanticRelationships, label: "Relationships" },
  { to: routes.SemanticPlanner, label: "Planner" },
  { to: routes.SemanticHelp, label: "Help" },
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
