import { Link } from "react-router-dom";

import { routes } from "@/app/navigation/routes";
import "../systemAdmin.css";

const setupSteps = [
  {
    step: "Step 1",
    title: "Start with domain profiles",
    why: "Profiles define the business framing for a domain before you enrich it with vectors or semantic assets.",
    action: "Confirm the domain scope, summary, key entities, metrics, and descriptive context first.",
  },
  {
    step: "Step 2",
    title: "Sync metadata into the workspace",
    why: "Metadata Sync brings in the source structure that downstream domain and semantic tooling relies on.",
    action: "Run metadata sync after datasource changes or schema refreshes so the workspace reflects current tables and columns.",
  },
  {
    step: "Step 3",
    title: "Refine and normalize in Data Refinery",
    why: "Refinery gives you a cleaner, more trustworthy input set before embeddings or higher-level semantic work run on top of it.",
    action: "Use Data Refinery to inspect, shape, and stabilize the data assets that matter most to your users.",
  },
  {
    step: "Step 4",
    title: "Rebuild vector indexes when source meaning changes",
    why: "Vector indexes must be refreshed when profiles, metadata, or semantic coverage changes materially.",
    action: "Use Vector Indexes after major data or profile updates so retrieval quality stays aligned with the current workspace.",
  },
  {
    step: "Step 5",
    title: "Watch ingestion health over time",
    why: "Problems usually show up first in sync runs, ingestion latency, or failed jobs rather than in the final UI.",
    action: "Use Ingestion Monitor to review run status, failures, and operational drift after syncs and rebuilds.",
  },
];

export default function DataFoundationHelpPage() {
  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1>Data Foundation Help</h1>
          <p className="sa-page-subtitle">
            A static guide to the order of operations for preparing domain, metadata, refinery, and vector assets in the admin workspace.
          </p>
        </div>
      </header>

      <section className="sa-help-grid" aria-label="Data foundation help overview">
        <article className="sa-help-card">
          <h2>What this section is for</h2>
          <p>
            Data Foundation is where the workspace source model gets stabilized. The pages in this section support domain context,
            metadata freshness, data refinement, operational monitoring, and retrieval quality.
          </p>
        </article>
        <article className="sa-help-card">
          <h2>What good looks like</h2>
          <ul>
            <li>Domain profiles describe the business surface clearly.</li>
            <li>Metadata is current and ingestion runs are healthy.</li>
            <li>Refined assets are consistent before downstream semantic work begins.</li>
            <li>Vector indexes are rebuilt after meaningful structural changes.</li>
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
          <p>Use these links while you work through the sequence above.</p>
          <div className="sa-help-links">
            <Link className="sa-help-link" to={routes.AdminDomainProfiles}>
              Domain Profiles
            </Link>
            <Link className="sa-help-link" to={routes.IngestionSync}>
              Metadata Sync
            </Link>
            <Link className="sa-help-link" to={routes.AdminDataRefinery}>
              Data Refinery
            </Link>
            <Link className="sa-help-link" to={routes.AdminVectorIndexes}>
              Vector Indexes
            </Link>
            <Link className="sa-help-link" to={routes.AdminIngestionMonitor}>
              Ingestion Monitor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
