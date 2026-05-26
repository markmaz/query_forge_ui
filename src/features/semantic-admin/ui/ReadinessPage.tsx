import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppSelector } from "@/shared/runtime/hooks";
import {
  fetchWorkflowIntelligenceSemanticReadiness,
  rebuildSemanticPlanIndexes,
  syncWorkflowIntelligenceSemanticReadiness,
  type WorkflowIntelligenceSemanticDomainReadiness,
} from "@/shared/services/semantic";
import useSemanticAdminPermissions from "../lib/useSemanticAdminPermissions";
import ApiErrorBanner from "./components/ApiErrorBanner";
import SemanticAdminShell from "./components/SemanticAdminShell";
import SemanticToast from "./components/Toast";
import "./styles/semanticAdmin.css";

const numberFormatter = new Intl.NumberFormat();

function formatCount(value: number | null | undefined): string {
  return numberFormatter.format(Number(value || 0));
}

function statusLabel(status: string): string {
  return status === "ready" ? "Ready" : "Needs attention";
}

function DomainReadinessCard({ domain }: { domain: WorkflowIntelligenceSemanticDomainReadiness }) {
  const issueList = domain.issues.length > 0 ? domain.issues : ["No semantic readiness issues found."];

  return (
    <article className={`semantic-readiness-domain ${domain.status === "ready" ? "ready" : "attention"}`}>
      <div className="semantic-readiness-domain-header">
        <div>
          <h3>{domain.display_name}</h3>
          <p>{domain.read_model}</p>
        </div>
        <span className="semantic-readiness-pill">{statusLabel(domain.status)}</span>
      </div>

      <div className="semantic-readiness-metrics" aria-label={`${domain.display_name} semantic coverage`}>
        <div>
          <strong>{formatCount(domain.counts.generated_concept_count)}</strong>
          <span>Concepts</span>
        </div>
        <div>
          <strong>{formatCount(domain.counts.generated_registry_count)}</strong>
          <span>Registry rows</span>
        </div>
        <div>
          <strong>{formatCount(domain.counts.semantic_column_map_count)}</strong>
          <span>Column maps</span>
        </div>
        <div>
          <strong>{formatCount(domain.metric_bindings.bound_metric_count)}</strong>
          <span>Bound metrics</span>
        </div>
      </div>

      <div className="semantic-readiness-domain-body">
        <div>
          <h4>Metric bindings</h4>
          <p>
            {formatCount(domain.metric_bindings.bound_metric_count)} of {formatCount(domain.metric_bindings.metric_count)} generated
            metrics are connected to a concrete read-model column.
          </p>
          {domain.metric_bindings.unbound_metrics.length > 0 || domain.metric_bindings.missing_metrics.length > 0 ? (
            <div className="semantic-readiness-chip-list">
              {[...domain.metric_bindings.missing_metrics, ...domain.metric_bindings.unbound_metrics].map((metric) => (
                <span key={metric}>{metric}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <h4>What to do</h4>
          <p>{domain.suggested_action}</p>
        </div>
      </div>

      <ul className="semantic-readiness-issues">
        {issueList.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </article>
  );
}

export default function ReadinessPage() {
  const queryClient = useQueryClient();
  const { canMutate } = useSemanticAdminPermissions();
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId ?? "");
  const [apiError, setApiError] = useState<string | null>(null);

  const readinessQ = useQuery({
    queryKey: ["semantic", "workflow-intelligence", "readiness", workspaceId],
    queryFn: fetchWorkflowIntelligenceSemanticReadiness,
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });

  const syncM = useMutation({
    mutationFn: syncWorkflowIntelligenceSemanticReadiness,
    onSuccess: async (response) => {
      SemanticToast.success(`Workflow Intelligence semantic sync completed (${response.registered_count ?? 0} domains).`);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "workflow-intelligence", "readiness"] });
    },
    onError: (error: Error) => {
      setApiError(error.message);
      SemanticToast.error(error.message);
    },
  });

  const rebuildM = useMutation({
    mutationFn: () => rebuildSemanticPlanIndexes({ workspace_id: workspaceId }),
    onSuccess: (results) => {
      const failed = results.filter((item) => !item.ok);
      if (failed.length > 0) {
        const message = failed[0]?.errorMessage ?? "Semantic index rebuild failed.";
        setApiError(message);
        SemanticToast.error(message);
        return;
      }
      SemanticToast.success("Semantic indexes rebuilt.");
    },
    onError: (error: Error) => {
      setApiError(error.message);
      SemanticToast.error(error.message);
    },
  });

  const domains = readinessQ.data?.domains ?? [];
  const sortedDomains = useMemo(
    () => [...domains].sort((a, b) => Number(a.status === "ready") - Number(b.status === "ready") || a.display_name.localeCompare(b.display_name)),
    [domains],
  );

  const actions = (
    <div className="semantic-readiness-actions">
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void readinessQ.refetch()} disabled={readinessQ.isFetching}>
        Refresh
      </button>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => rebuildM.mutate()} disabled={!canMutate || !workspaceId || rebuildM.isPending}>
        Rebuild indexes
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => syncM.mutate()} disabled={!canMutate || !workspaceId || syncM.isPending}>
        Sync semantics
      </button>
    </div>
  );

  return (
    <SemanticAdminShell
      title="Semantic Readiness"
      subtitle="Checks whether Workflow Intelligence has the generated semantic concepts, registry rows, column maps, aliases, and metric bindings Query Studio needs."
      actions={actions}
    >
      {apiError ? <ApiErrorBanner message={apiError} onDismiss={() => setApiError(null)} /> : null}
      {!workspaceId ? (
        <div className="alert alert-warning">Choose a workspace before checking Workflow Intelligence semantic readiness.</div>
      ) : null}
      {readinessQ.isError ? <ApiErrorBanner message={(readinessQ.error as Error).message} /> : null}

      {readinessQ.data ? (
        <>
          <section className={`semantic-readiness-hero ${readinessQ.data.status === "ready" ? "ready" : "attention"}`}>
            <div>
              <span className="semantic-readiness-eyebrow">Workflow Intelligence</span>
              <h2>{readinessQ.data.status === "ready" ? "Semantic layer is ready" : "Semantic layer needs attention"}</h2>
              <p>
                {formatCount(readinessQ.data.summary.ready_domain_count)} of {formatCount(readinessQ.data.summary.domain_count)} generated domains are ready.
              </p>
            </div>
            <div className="semantic-readiness-summary" aria-label="Workflow Intelligence semantic readiness summary">
              <div>
                <strong>{formatCount(readinessQ.data.summary.generated_concept_count)}</strong>
                <span>Concepts</span>
              </div>
              <div>
                <strong>{formatCount(readinessQ.data.summary.generated_registry_count)}</strong>
                <span>Registry rows</span>
              </div>
              <div>
                <strong>{formatCount(readinessQ.data.summary.semantic_column_map_count)}</strong>
                <span>Column maps</span>
              </div>
              <div>
                <strong>{formatCount(readinessQ.data.summary.bound_metric_count)}</strong>
                <span>Bound metrics</span>
              </div>
            </div>
          </section>

          <section className="semantic-readiness-guide" aria-label="What this readiness check verifies">
            <div>
              <h3>Why this matters</h3>
              <p>
                Query Studio cannot select useful columns from Workflow Intelligence unless generated metrics and concepts are stored in the semantic tables and mapped back to read-model columns.
              </p>
            </div>
            <div>
              <h3>Repair order</h3>
              <p>
                Sync semantics first. Rebuild indexes after the semantic tables look complete so prompt matching can see the repaired concepts and aliases.
              </p>
            </div>
          </section>

          <section className="semantic-readiness-domain-list" aria-label="Workflow Intelligence semantic domain readiness">
            {sortedDomains.map((domain) => (
              <DomainReadinessCard key={domain.domain_key} domain={domain} />
            ))}
          </section>
        </>
      ) : readinessQ.isLoading ? (
        <div className="semantic-admin-card p-4">Checking semantic readiness...</div>
      ) : null}
    </SemanticAdminShell>
  );
}
