import { Link } from "react-router-dom";

import { routes } from "@/app/navigation/routes";
import "../systemAdmin.css";

const setupSteps = [
  {
    step: "Step 1",
    title: "Initialize the tenancy model",
    why: "Initialization establishes the core structures and expected baseline before individual records are managed manually.",
    action: "Use Initialize first when standing up a new environment or validating the tenancy baseline.",
  },
  {
    step: "Step 2",
    title: "Define organizations clearly",
    why: "Organizations are the top-level grouping for the customer model and should be in place before binding workspaces and resources.",
    action: "Create and review organizations before assigning datasources, bindings, or workspace-specific services.",
  },
  {
    step: "Step 3",
    title: "Register datasources",
    why: "Datasource definitions control what infrastructure and connection settings are available for workspace assignment.",
    action: "Add datasources and validate configuration before wiring them into workspace bindings.",
  },
  {
    step: "Step 4",
    title: "Bind workspaces deliberately",
    why: "Workspace bindings determine which organizations and datasources are active in each workspace context.",
    action: "Use Workspaces to confirm each workspace points at the right tenancy objects and data sources.",
  },
  {
    step: "Step 5",
    title: "Configure workspace LLMs last",
    why: "LLM assignment depends on the correct workspace context already existing and being attached to the right tenancy structures.",
    action: "Add or update Workspace LLMs after organizations, datasources, and bindings are stable.",
  },
];

export default function TenancyHelpPage() {
  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1>Tenancy Help</h1>
          <p className="sa-page-subtitle">
            A static guide for setting up and maintaining organizations, datasources, workspaces, and workspace-level model setup.
          </p>
        </div>
      </header>

      <section className="sa-help-grid" aria-label="Tenancy help overview">
        <article className="sa-help-card">
          <h2>What this section is for</h2>
          <p>
            Tenancy controls the administrative structure behind organizations, shared infrastructure, workspaces, and workspace-level model setup.
          </p>
        </article>
        <article className="sa-help-card">
          <h2>What good looks like</h2>
          <ul>
            <li>Organizations are defined and active.</li>
            <li>Datasources are registered and testable.</li>
            <li>Workspaces reflect the intended ownership model.</li>
            <li>Workspace LLM assignments are configured only after the base tenancy model is stable.</li>
          </ul>
        </article>
      </section>

      <section className="sa-card mb-3">
        <div className="sa-help-card">
          <h2>Recommended setup sequence</h2>
          <div className="sa-help-step-list">
            {setupSteps.map((item) => (
              <article key={item.step} className="sa-help-step">
                <div className="sa-help-step-label">{item.step}</div>
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

      <section className="sa-card">
        <div className="sa-help-card">
          <h2>Jump to the related pages</h2>
          <p>Use these links while you work through tenancy setup and review.</p>
          <div className="sa-help-links">
            <Link className="sa-help-link" to={routes.AdminCustomerInitialization}>
              Initialize
            </Link>
            <Link className="sa-help-link" to={routes.AdminTenancyOrganizations}>
              Organizations
            </Link>
            <Link className="sa-help-link" to={routes.AdminTenancyDatasources}>
              Datasources
            </Link>
            <Link className="sa-help-link" to={routes.AdminTenancyWorkspaceBindings}>
              Workspaces
            </Link>
            <Link className="sa-help-link" to={routes.AdminTenancyWorkspaceLLMs}>
              Workspace LLMs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
