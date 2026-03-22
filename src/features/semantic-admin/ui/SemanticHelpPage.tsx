import { Link } from "react-router-dom";

import { routes } from "@/app/navigation/routes";
import SemanticAdminShell from "./components/SemanticAdminShell";
import "./styles/semanticAdmin.css";

const setupSteps = [
  {
    step: "Step 1",
    title: "Start with the domain profile",
    why: "The semantic layer works best when the domain already has a clear business summary, table context, and vertical.",
    action:
      "Confirm the domain name, vertical, business purpose, and source tables before you start creating concepts.",
  },
  {
    step: "Step 2",
    title: "Create the core concepts",
    why: "Concepts are the stable business terms the planner and matching workflows use to interpret user intent.",
    action:
      "Define the highest-value measures, identifiers, dimensions, and status fields first. Keep names business-facing and descriptions explicit.",
  },
  {
    step: "Step 3",
    title: "Add aliases and value aliases",
    why: "Users rarely type the exact canonical term. Aliases make search, matching, and planning resilient to real language.",
    action:
      "Add business synonyms, common abbreviations, and alternative labels. Use value aliases for coded values like statuses, grade bands, or program types.",
  },
  {
    step: "Step 4",
    title: "Define relationships",
    why: "Relationships help the system understand how concepts depend on or roll up to each other across the registry.",
    action:
      "Capture parent-child, dependency, and grouping relationships where they materially improve interpretation and downstream mapping.",
  },
  {
    step: "Step 5",
    title: "Run Catalog Builder after the basics are ready",
    why: "Catalog Builder can seed or enrich the registry from domain metadata, but it works best when it has a clean domain target and naming direction.",
    action:
      "Use preview mode first, review the suggested concepts and aliases, then run the write mode when the output looks aligned.",
  },
  {
    step: "Step 6",
    title: "Validate in planner and downstream workflows",
    why: "The registry is only useful if it improves actual prompt interpretation, matching quality, and semantic navigation.",
    action:
      "Test representative prompts, confirm concept matches, and tighten descriptions or aliases anywhere the planner is ambiguous.",
  },
];

export default function SemanticHelpPage() {
  return (
    <SemanticAdminShell
      title="Semantic Help"
      subtitle="A static setup guide for building the semantic registry in a practical order, with the reason each step matters."
    >
      <section className="semantic-help-grid" aria-label="Semantic help overview">
        <article className="semantic-help-card">
          <h2>What this page is for</h2>
          <p>
            The semantic registry is the shared vocabulary behind concept matching, planner behavior, aliases, and catalog enrichment.
            This page gives admins a recommended order of operations so the registry is built intentionally instead of one-off.
          </p>
        </article>
        <article className="semantic-help-card">
          <h2>What good looks like</h2>
          <ul>
            <li>Core business terms are defined once and reused consistently.</li>
            <li>Aliases reflect how users actually talk about the data.</li>
            <li>Relationships explain how concepts connect or roll up.</li>
            <li>Catalog Builder is used to accelerate curation, not replace review.</li>
          </ul>
        </article>
      </section>

      <section className="semantic-admin-card mt-3">
        <div className="semantic-help-card">
          <h2>Recommended setup sequence</h2>
          <div className="semantic-help-step-list">
            {setupSteps.map((item) => (
              <article key={item.step} className="semantic-help-step">
                <div className="semantic-help-step-label">{item.step}</div>
                <h3>{item.title}</h3>
                <p>
                  <strong>Why:</strong> {item.why}
                </p>
                <p>
                  <strong>What to do:</strong> {item.action}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="semantic-admin-card mt-3">
        <div className="semantic-help-card">
          <h2>Jump to the related pages</h2>
          <p>
            If you are actively working through the setup, these links take you directly to the pages used in the sequence above.
          </p>
          <div className="semantic-help-links">
            <Link className="semantic-help-link" to={routes.AdminDomainProfiles}>
              Domain Profiles
            </Link>
            <Link className="semantic-help-link" to={routes.SemanticConcepts}>
              Concepts
            </Link>
            <Link className="semantic-help-link" to={routes.SemanticAliases}>
              Aliases
            </Link>
            <Link className="semantic-help-link" to={routes.SemanticValueAliases}>
              Value Aliases
            </Link>
            <Link className="semantic-help-link" to={routes.AdminSemanticRelationships}>
              Relationships
            </Link>
            <Link className="semantic-help-link" to={routes.AdminSemanticCatalogBuilder}>
              Catalog Builder
            </Link>
            <Link className="semantic-help-link" to={routes.SemanticPlanner}>
              Planner
            </Link>
          </div>
        </div>
      </section>
    </SemanticAdminShell>
  );
}
