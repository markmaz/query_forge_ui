import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createFlowForgeMatchingPolicyLLMDraft,
  createFlowForgeMatchingPolicy,
  deleteFlowForgeMatchingPolicy,
  deleteFlowForgeMatchingPolicyVersion,
  listFlowForgeMatchingPolicies,
  listFlowForgeMatchingPolicyVersions,
  listFlowForgeResourceRecords,
  listFlowForgeResourceSets,
  simulateFlowForgeMatchingPolicy,
} from "../api/adminApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import {
  buildFieldOptions,
  compactResourceRecord,
  compatibleOperators,
  createDefaultEligibilityRule,
  createDefaultScoringRule,
  createPolicyFromBuilderState,
  defaultBuilderState,
  type MatchingPolicyRuleState,
  operatorLabel,
  policyToBuilderState,
  titleize,
  VALUELESS_OPERATORS,
} from "../model/matchingPolicyBuilder";
import "./flowforge.css";
import "./flowforgeAdmin.css";

const defaultPolicy = JSON.stringify(
  {
    version: 1,
    eligibility: [{ id: "eligibility-1", field: "effective_status", operator: "equals", value: "active", reason: "Resource must be active" }],
    scoring: [{ id: "scoring-1", field: "capacity_available", operator: "gt", value: 0, weight: 10, reason: "Reward open capacity" }],
    selection: {
      strategy: "balanced_top_ranked",
      fairness: {
        within_score_delta: 0,
        penalize_active_offers: true,
        prefer_least_recently_offered: true,
      },
    },
  },
  null,
  2,
);

const defaultResources = JSON.stringify(
  [
    { source_record_key: "resource-1", display_name: "Jane Resource", effective_status: "active", capacity_available: 3 },
    { source_record_key: "resource-2", display_name: "Alex Resource", effective_status: "inactive", capacity_available: 8 },
  ],
  null,
  2,
);

const candidateLabel = (candidate?: Record<string, unknown> | null) => {
  if (!candidate) return "No candidate selected";
  return String(candidate.display_name ?? candidate.source_record_key ?? candidate.id ?? "Selected candidate");
};

const slugifyPolicyKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);

const createPolicyKeySuffix = () => `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`;

const buildGeneratedPolicyKey = (displayName: string, suffix: string) => `${slugifyPolicyKey(displayName) || "matching-policy"}-${suffix}`;

type FlowForgeAiEntry = {
  id: string;
  prompt: string;
  responseMessage: string;
  nextActions: Array<{ label: string; reason: string; prompt: string; resourceSetId?: number }>;
};

function PolicyCardMenu({ canDelete, deletePending, onDelete, onOpen }: { canDelete: boolean; deletePending: boolean; onDelete: () => void; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-workflow-card-menu">
      <button
        type="button"
        className="ff-workflow-card-menu-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        title="Policy options"
        aria-label="Policy options"
      >
        <i className="fa fa-ellipsis-v" aria-hidden="true" />
      </button>
      {open ? (
        <div className="ff-workflow-menu-popover" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            Open policy
          </button>
          <div className="ff-workflow-menu-divider" />
          <button
            type="button"
            disabled={!canDelete || deletePending}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {canDelete ? "Delete policy" : "Published policy protected"}
          </button>
        </div>
      ) : null}
      {open ? <div className="ff-workflow-menu-backdrop" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}

function PolicyVersionCardMenu({
  canDelete,
  deletePending,
  onDelete,
}: {
  canDelete: boolean;
  deletePending: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-workflow-card-menu">
      <button
        type="button"
        className="ff-workflow-card-menu-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        title="Version options"
        aria-label="Version options"
      >
        <i className="fa fa-ellipsis-v" aria-hidden="true" />
      </button>
      {open ? (
        <div className="ff-workflow-menu-popover" onClick={(event) => event.stopPropagation()}>
          <button type="button" disabled>
            Open version
          </button>
          <div className="ff-workflow-menu-divider" />
          <button
            type="button"
            disabled={!canDelete || deletePending}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {canDelete ? "Delete version" : "Published version protected"}
          </button>
        </div>
      ) : null}
      {open ? <div className="ff-workflow-menu-backdrop" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}

export default function FlowForgeMatchingPoliciesPage() {
  const queryClient = useQueryClient();
  const [policyKey, setPolicyKey] = useState("intake-routing-policy");
  const [displayName, setDisplayName] = useState("Intake Routing Policy");
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);
  const [isCreatingNewPolicy, setIsCreatingNewPolicy] = useState(false);
  const [savedPoliciesOpen, setSavedPoliciesOpen] = useState(true);
  const [resourceSetId, setResourceSetId] = useState("");
  const [builderState, setBuilderState] = useState(defaultBuilderState);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [aiHistory, setAiHistory] = useState<FlowForgeAiEntry[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [copiedPromptKey, setCopiedPromptKey] = useState<string | null>(null);
  const [useAdvancedPolicyJson, setUseAdvancedPolicyJson] = useState(false);
  const [useSavedResourceRecords, setUseSavedResourceRecords] = useState(true);
  const [policyJson, setPolicyJson] = useState(defaultPolicy);
  const [resourcesJson, setResourcesJson] = useState(defaultResources);
  const [error, setError] = useState<string | null>(null);
  const aiThreadRef = useRef<HTMLDivElement | null>(null);

  const policiesQuery = useQuery({
    queryKey: ["flowforge", "admin", "matching-policies"],
    queryFn: listFlowForgeMatchingPolicies,
  });
  const resourceSetsQuery = useQuery({
    queryKey: ["flowforge", "admin", "resource-sets"],
    queryFn: listFlowForgeResourceSets,
  });
  const activePolicyId = isCreatingNewPolicy ? null : selectedPolicyId;
  const hasPolicyEditorOpen = isCreatingNewPolicy || Boolean(activePolicyId);
  const selectedResourceSetId = Number(resourceSetId || 0);
  const hasSelectedResourceSet = Boolean(selectedResourceSetId);
  const recordsQuery = useQuery({
    queryKey: ["flowforge", "admin", "resource-records", selectedResourceSetId],
    queryFn: () => listFlowForgeResourceRecords(selectedResourceSetId),
    enabled: hasSelectedResourceSet,
  });
  const versionsQuery = useQuery({
    queryKey: ["flowforge", "admin", "matching-policy-versions", activePolicyId],
    queryFn: () => listFlowForgeMatchingPolicyVersions(activePolicyId as number),
    enabled: Boolean(activePolicyId),
  });
  const resourceFieldOptions = useMemo(
    () => {
      if (!hasSelectedResourceSet) return [];
      const fields = new Map(buildFieldOptions(recordsQuery.data?.records ?? []).map((field) => [field.key, field]));
      [...builderState.eligibilityRules, ...builderState.scoringRules].forEach((rule) => {
        if (rule.field && !fields.has(rule.field)) {
          fields.set(rule.field, { key: rule.field, label: titleize(rule.field), type: "unknown", source: "resource" });
        }
      });
      return [...fields.values()].sort((left, right) => left.label.localeCompare(right.label));
    },
    [builderState.eligibilityRules, builderState.scoringRules, hasSelectedResourceSet, recordsQuery.data?.records],
  );
  useEffect(() => {
    const thread = aiThreadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [aiHistory.length, pendingPrompt]);
  const applyBuilderState = (nextState: typeof builderState) => setBuilderState(nextState);
  const builtPolicy = useMemo(
    () => createPolicyFromBuilderState(builderState, resourceFieldOptions.length ? resourceFieldOptions : buildFieldOptions()),
    [builderState, resourceFieldOptions],
  );
  const builtPolicyJson = useMemo(() => JSON.stringify(builtPolicy, null, 2), [builtPolicy]);
  const getPolicyForRequest = () => (useAdvancedPolicyJson ? (JSON.parse(policyJson) as Record<string, unknown>) : builtPolicy);
  const buildUniquePolicyKey = (preferredKey: string) => {
    const existingKeys = new Set(
      (policiesQuery.data ?? [])
        .filter((policy) => policy.id !== activePolicyId)
        .map((policy) => String(policy.policy_key || "").trim())
        .filter(Boolean),
    );
    const baseKey = slugifyPolicyKey(preferredKey) || buildGeneratedPolicyKey(displayName, createPolicyKeySuffix());
    if (!existingKeys.has(baseKey)) return baseKey;
    let suffix = createPolicyKeySuffix();
    let candidate = `${baseKey}-${suffix}`;
    while (existingKeys.has(candidate)) {
      suffix = createPolicyKeySuffix();
      candidate = `${baseKey}-${suffix}`;
    }
    return candidate;
  };
  const getResourcesForSimulation = () => {
    if (useSavedResourceRecords && recordsQuery.data?.records?.length) {
      return recordsQuery.data.records.map(compactResourceRecord);
    }
    return JSON.parse(resourcesJson) as Array<Record<string, unknown>>;
  };
  const createPolicyMutation = useMutation({
    mutationFn: () => {
      const nextPolicyKey = buildUniquePolicyKey(policyKey);
      return createFlowForgeMatchingPolicy({
        policy_key: nextPolicyKey,
        display_name: displayName,
        resource_set_id: selectedResourceSetId,
        policy: getPolicyForRequest(),
      });
    },
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to create policy."),
    onSuccess: async (created) => {
      setError(null);
      setPolicyKey(created.policy_key);
      setIsCreatingNewPolicy(false);
      setSelectedPolicyId(created.id);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "matching-policies"] });
    },
  });
  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: number) => {
      if (!activePolicyId) throw new Error("Select a matching policy before deleting a version.");
      return deleteFlowForgeMatchingPolicyVersion(activePolicyId, versionId);
    },
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to delete policy version."),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "matching-policy-versions", activePolicyId] });
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "matching-policies"] });
    },
  });
  const deletePolicyMutation = useMutation({
    mutationFn: (policyId: number) => deleteFlowForgeMatchingPolicy(policyId),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to delete policy."),
    onSuccess: async (_deleted, policyId) => {
      setError(null);
      if (selectedPolicyId === policyId) {
        setSelectedPolicyId(null);
        setIsCreatingNewPolicy(false);
      }
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "matching-policies"] });
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "matching-policy-versions", policyId] });
    },
  });
  const draftPolicyMutation = useMutation({
    mutationFn: async ({ prompt, resourceSetId: draftResourceSetId }: { prompt: string; resourceSetId: number }) => {
      if (!draftResourceSetId) throw new Error("Choose a resource pool before drafting with AI.");
      let policyId = activePolicyId;
      let createdPolicy: Awaited<ReturnType<typeof createFlowForgeMatchingPolicy>> | null = null;
      if (!policyId) {
        const nextPolicyKey = buildUniquePolicyKey(policyKey);
        createdPolicy = await createFlowForgeMatchingPolicy({
          policy_key: nextPolicyKey,
          display_name: displayName,
          resource_set_id: draftResourceSetId,
          policy: getPolicyForRequest(),
        });
        policyId = createdPolicy.id;
      }
      const draft = await createFlowForgeMatchingPolicyLLMDraft(policyId, {
        prompt,
        resource_set_id: draftResourceSetId,
        resource_fields: resourceFieldOptions.map((field) => ({ key: field.key, type: field.type, label: field.label })),
        use_llm: true,
      });
      return { draft, createdPolicy };
    },
    onError: (mutationError, request) => {
      const message = mutationError instanceof Error ? mutationError.message : "Unable to draft policy.";
      setError(message);
      setPendingPrompt("");
      setAiHistory((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          prompt: request.prompt,
          responseMessage: message,
          nextActions: [
            {
              label: "Try again",
              reason: "Retry the same policy drafting prompt.",
              prompt: request.prompt,
              resourceSetId: request.resourceSetId,
            },
          ],
        },
      ]);
    },
    onSuccess: async ({ draft, createdPolicy }, request) => {
      setError(null);
      setUseAdvancedPolicyJson(false);
      if (createdPolicy) {
        setIsCreatingNewPolicy(false);
        setSelectedPolicyId(createdPolicy.id);
        setPolicyKey(createdPolicy.policy_key);
        await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "matching-policies"] });
      }
      applyBuilderState(policyToBuilderState(draft.generated_policy));
      setPendingPrompt("");
      setDraftPrompt("");
      setAiHistory((current) => [
        ...current,
        {
          id: `draft-${Date.now()}`,
          prompt: request.prompt,
          responseMessage: draft.plain_language_summary || "Draft generated and loaded into the builder.",
          nextActions: [
            {
              label: "Simulate this policy",
              reason: "Run the generated rules against the selected resource records.",
              prompt: "Simulate this matching policy with the current resource pool.",
            },
            {
              label: "Make the policy stricter",
              reason: "Ask FlowForge AI to add stronger eligibility gates.",
              prompt: "Make this policy stricter by adding clearer eligibility requirements.",
            },
          ],
        },
      ]);
    },
  });
  const simulationMutation = useMutation({
    mutationFn: () =>
      simulateFlowForgeMatchingPolicy({
        policy: getPolicyForRequest(),
        resources: getResourcesForSimulation(),
        context: {},
      }),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to simulate policy."),
    onSuccess: () => setError(null),
  });
  const startNewPolicy = () => {
    const nextPolicyKey = buildGeneratedPolicyKey("New Matching Policy", createPolicyKeySuffix());
    setIsCreatingNewPolicy(true);
    setSelectedPolicyId(null);
    setPolicyKey(nextPolicyKey);
    setDisplayName("New Matching Policy");
    setResourceSetId("");
    applyBuilderState(defaultBuilderState);
    setDraftPrompt("");
    setPendingPrompt("");
    setUseAdvancedPolicyJson(false);
    setPolicyJson(defaultPolicy);
    setResourcesJson(defaultResources);
    setError(null);
    createPolicyMutation.reset();
    draftPolicyMutation.reset();
    simulationMutation.reset();
  };
  const selectPolicy = (policy: { id: number; policy_key: string; display_name: string; resource_set_id: number }) => {
    setIsCreatingNewPolicy(false);
    setSelectedPolicyId(policy.id);
    setPolicyKey(policy.policy_key);
    setDisplayName(policy.display_name);
    setResourceSetId(String(policy.resource_set_id));
    setDraftPrompt("");
    setPendingPrompt("");
    setError(null);
    simulationMutation.reset();
  };
  const nextRuleId = (prefix: "eligibility" | "scoring", rules: MatchingPolicyRuleState[]) => `${prefix}-${rules.length + 1}-${Date.now()}`;
  const updateEligibilityRule = (ruleId: string, patch: Partial<MatchingPolicyRuleState>) => {
    setBuilderState((current) => ({
      ...current,
      eligibilityRules: current.eligibilityRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }));
  };
  const updateScoringRule = (ruleId: string, patch: Partial<MatchingPolicyRuleState>) => {
    setBuilderState((current) => ({
      ...current,
      scoringRules: current.scoringRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }));
  };
  const updateFairnessWindow = (fairnessWindowScoreDelta: string) => {
    setBuilderState((current) => ({
      ...current,
      fairnessWindowScoreDelta,
    }));
  };
  const addEligibilityRule = () => {
    setBuilderState((current) => ({
      ...current,
      eligibilityRules: [...current.eligibilityRules, createDefaultEligibilityRule(nextRuleId("eligibility", current.eligibilityRules))],
    }));
  };
  const addScoringRule = () => {
    setBuilderState((current) => ({
      ...current,
      scoringRules: [...current.scoringRules, createDefaultScoringRule(nextRuleId("scoring", current.scoringRules))],
    }));
  };
  const removeEligibilityRule = (ruleId: string) => {
    setBuilderState((current) => ({
      ...current,
      eligibilityRules: current.eligibilityRules.length > 1 ? current.eligibilityRules.filter((rule) => rule.id !== ruleId) : current.eligibilityRules,
    }));
  };
  const removeScoringRule = (ruleId: string) => {
    setBuilderState((current) => ({
      ...current,
      scoringRules: current.scoringRules.length > 1 ? current.scoringRules.filter((rule) => rule.id !== ruleId) : current.scoringRules,
    }));
  };
  const fieldTypeFor = (fieldKey: string) => resourceFieldOptions.find((field) => field.key === fieldKey)?.type ?? "unknown";
  const ensureCompatibleOperator = (fieldKey: string, currentOperator: string) => {
    const operators = compatibleOperators(fieldTypeFor(fieldKey));
    return operators.some((operator) => operator.value === currentOperator) ? currentOperator : "equals";
  };
  const copyPromptToClipboard = async (promptText: string, promptKey: string) => {
    try {
      await navigator.clipboard?.writeText(promptText);
      setCopiedPromptKey(promptKey);
      window.setTimeout(() => {
        setCopiedPromptKey((current) => (current === promptKey ? null : current));
      }, 1400);
    } catch {
      // Copying is a convenience action only.
    }
  };
  const submitDraftPrompt = (promptOverride?: string, options?: { resourceSetId?: number }) => {
    const nextPrompt = (promptOverride ?? draftPrompt).trim();
    if (!nextPrompt || draftPolicyMutation.isPending) return;
    const draftResourceSetId = options?.resourceSetId ?? selectedResourceSetId;
    if (!draftResourceSetId) {
      const availableResourceSets = resourceSetsQuery.data ?? [];
      setError(null);
      setPendingPrompt("");
      setAiHistory((current) => [
        ...current,
        {
          id: `resource-pool-choice-${Date.now()}`,
          prompt: nextPrompt,
          responseMessage: availableResourceSets.length
            ? "I can draft that policy, but I need to know which resource pool to use first. Choose one below and I will continue with your prompt."
            : "I can draft that policy after a resource pool exists. Create a resource pool first, then send this prompt again.",
          nextActions: availableResourceSets.map((resourceSet) => ({
            label: resourceSet.display_name,
            reason: `Use ${resourceSet.resource_set_key} for policy fields and validation.`,
            prompt: nextPrompt,
            resourceSetId: resourceSet.id,
          })),
        },
      ]);
      return;
    }
    setError(null);
    setPendingPrompt(nextPrompt);
    draftPolicyMutation.mutate({ prompt: nextPrompt, resourceSetId: draftResourceSetId });
  };
  const stopDrafting = () => {
    setPendingPrompt("");
    draftPolicyMutation.reset();
  };
  const handleAiSendButtonClick = () => {
    if (draftPolicyMutation.isPending) {
      stopDrafting();
      return;
    }
    submitDraftPrompt();
  };
  const clearAiHistory = () => {
    setAiHistory([]);
    setPendingPrompt("");
    setError(null);
    draftPolicyMutation.reset();
  };
  const startNewAiSession = () => {
    clearAiHistory();
    setDraftPrompt("");
  };

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Matching Policies"
        description="Define who is eligible, how resources are ranked, and what the workflow should pick first."
      />

      <section
        className={`ff-policy-studio ${savedPoliciesOpen ? "is-saved-open" : "is-saved-collapsed"}`}
        aria-label="Matching policy studio"
      >
        <div className={`ff-policy-left-cluster ${savedPoliciesOpen ? "is-open" : "is-collapsed"}`}>
          <aside className="ncqv2-builder-rail ff-policy-saved-rail" aria-label="Matching policy tools">
            <div className="ncqv2-rail-top">
              <button type="button" className="btn btn-primary" onClick={startNewPolicy} title="New Policy" aria-label="Create New Policy">
                <i className="fa fa-plus" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn ${savedPoliciesOpen ? "btn-primary" : "btn-outline-secondary"}`}
                title={savedPoliciesOpen ? "Hide Saved Policies" : "Show Saved Policies"}
                aria-label="Saved Policies"
                aria-expanded={savedPoliciesOpen}
                onClick={() => setSavedPoliciesOpen((current) => !current)}
              >
                <i className="fa fa-folder-open" aria-hidden="true" />
              </button>
            </div>
            <div className="ncqv2-rail-divider" />
            <button type="button" className="btn btn-outline-secondary" title="Policy Versions" aria-label="Policy Versions">
              <i className="fa fa-code-branch" aria-hidden="true" />
            </button>
          </aside>

          <aside className="ff-policy-saved-panel" aria-label="Saved matching policies" aria-hidden={!savedPoliciesOpen}>
            <section className="ff-policy-sidebar-section" aria-labelledby="ff-existing-policies-heading">
              <div className="ff-policy-panel-header">
                <div>
                  <h2 id="ff-existing-policies-heading">Saved Policies</h2>
                  <p className="ff-admin-helper">Open a policy, create a draft, or manage saved versions.</p>
                </div>
              </div>
              <details className="ff-policy-help-box">
                <summary>How matching policies work</summary>
                <div className="ff-policy-help-steps" aria-label="Matching policy setup steps">
                  <article>
                    <span>1</span>
                    <strong>Choose the resource pool</strong>
                    <p>Select the people or assets this policy is allowed to evaluate.</p>
                  </article>
                  <article>
                    <span>2</span>
                    <strong>Define matching rules</strong>
                    <p>Set eligibility and ranking rules so FlowForge can make repeatable decisions.</p>
                  </article>
                  <article>
                    <span>3</span>
                    <strong>Simulate before saving</strong>
                    <p>Run sample resources through the policy to confirm who is selected and why.</p>
                  </article>
                </div>
              </details>
              {isCreatingNewPolicy ? (
                <div className="ff-policy-new-state">
                  <strong>New policy draft</strong>
                  <p>Fill out the policy details, choose a resource pool, then save before using auditable AI drafting.</p>
                </div>
              ) : null}
              <div className="ff-admin-list">
                {(policiesQuery.data ?? []).map((policy) => (
                  <article key={policy.id} className={`ff-admin-card ff-policy-card ${policy.id === activePolicyId ? "is-active" : ""}`}>
                    <button type="button" className="ff-policy-card-main" onClick={() => selectPolicy(policy)}>
                      <div>
                        <span className="ff-policy-card-title">{policy.display_name}</span>
                        <span className="ff-policy-card-meta">
                          {policy.policy_key} · resource set {policy.resource_set_id}
                        </span>
                      </div>
                      <span className="ff-policy-status-pill">{policy.id === activePolicyId ? "Open" : policy.status}</span>
                    </button>
                    <PolicyCardMenu
                      canDelete={!policy.latest_published_version_id}
                      deletePending={deletePolicyMutation.isPending}
                      onDelete={() => deletePolicyMutation.mutate(policy.id)}
                      onOpen={() => selectPolicy(policy)}
                    />
                  </article>
                ))}
                {!policiesQuery.data?.length ? <div className="ff-empty-state">No matching policies yet. Create one to start routing resources.</div> : null}
              </div>
            </section>

            <section className="ff-policy-sidebar-section" aria-labelledby="ff-saved-versions-heading">
              <h2 id="ff-saved-versions-heading">Saved Versions</h2>
              <p className="ff-admin-helper">Versions preserve the exact rules used by workflow runs and simulations.</p>
              <div className="ff-admin-list">
                {(versionsQuery.data ?? []).map((version) => (
                  <article key={version.id} className="ff-admin-card ff-policy-version-card">
                    <div className="ff-policy-version-main">
                      <div>
                        <span className="ff-policy-card-title">Version {version.version_number}</span>
                        <span className="ff-policy-card-meta">
                          {version.validation_status} · {version.version_status} · resource set {version.resource_set_id}
                        </span>
                      </div>
                      <span className="ff-policy-status-pill">{version.version_status}</span>
                    </div>
                    <PolicyVersionCardMenu
                      canDelete={version.version_status !== "published"}
                      deletePending={deleteVersionMutation.isPending}
                      onDelete={() => deleteVersionMutation.mutate(version.id)}
                    />
                  </article>
                ))}
                {activePolicyId && !versionsQuery.isLoading && !versionsQuery.data?.length ? (
                  <div className="ff-empty-state">No versions have been saved for this policy yet.</div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        <main className="ff-runtime-panel ff-policy-workspace">
          {hasPolicyEditorOpen ? (
            <>
              <h2>Build and Test a Policy</h2>
              <p className="ff-admin-helper">
                Start with a resource pool, adjust the matching rules, simulate the outcome, then save the policy when the result looks right.
              </p>
          <form
            className="ff-admin-form ff-policy-form"
            onSubmit={(event) => {
              event.preventDefault();
              createPolicyMutation.mutate();
            }}
          >
            <div className="ff-settings-field-grid">
              <label>
                Policy Key
                <input value={policyKey} onChange={(event) => setPolicyKey(event.target.value)} />
              </label>
              <label>
                Display Name
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
            </div>
            <label>
              Resource Pool to Evaluate
              <select
                value={resourceSetId}
                onChange={(event) => {
                  setResourceSetId(event.target.value);
                  simulationMutation.reset();
                }}
              >
                <option value="">Select resource set</option>
                {(resourceSetsQuery.data ?? []).map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.display_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="ff-policy-rule-help">
              <strong>Current rule summary</strong>
              {hasSelectedResourceSet ? (
                <p>
                  The policy applies {builderState.eligibilityRules.length} eligibility rule{builderState.eligibilityRules.length === 1 ? "" : "s"} before
                  scoring, then ranks matching resources with {builderState.scoringRules.length} scoring rule
                  {builderState.scoringRules.length === 1 ? "" : "s"}. Candidates within {builderState.fairnessWindowScoreDelta || "0"} score points
                  of the best match are balanced by active offers and last offer date.
                </p>
              ) : (
                <p>Choose a resource pool before defining eligibility or ranking rules.</p>
              )}
            </div>
            <section className="ff-policy-builder-section" aria-label="Eligibility rule builder">
              <div>
                <h3>Who is eligible?</h3>
                <p>Start with a simple gate. Resources that fail this rule are excluded before scoring.</p>
              </div>
              {!hasSelectedResourceSet ? (
                <div className="ff-policy-field-gate">Choose a resource pool to load available eligibility fields.</div>
              ) : (
                <div className="ff-policy-rule-stack">
                  {builderState.eligibilityRules.map((rule, index) => {
                    const operators = compatibleOperators(fieldTypeFor(rule.field));
                    return (
                      <div className="ff-policy-rule-row" key={rule.id}>
                        <label>
                          Eligibility Field
                          <select
                            value={rule.field}
                            onChange={(event) =>
                              updateEligibilityRule(rule.id, {
                                field: event.target.value,
                                operator: ensureCompatibleOperator(event.target.value, rule.operator),
                              })
                            }
                          >
                            {resourceFieldOptions.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label} ({field.type})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Eligibility Operator
                          <select value={rule.operator} onChange={(event) => updateEligibilityRule(rule.id, { operator: event.target.value })}>
                            {operators.map((operator) => (
                              <option key={operator.value} value={operator.value}>
                                {operator.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Eligibility Value
                          <input
                            value={rule.value}
                            disabled={VALUELESS_OPERATORS.has(rule.operator)}
                            placeholder={rule.operator === "between" ? "1, 10" : index === 0 ? "active" : "Spanish"}
                            onChange={(event) => updateEligibilityRule(rule.id, { value: event.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-outline-secondary ff-policy-rule-remove"
                          disabled={builderState.eligibilityRules.length === 1}
                          onClick={() => removeEligibilityRule(rule.id)}
                          aria-label={`Remove eligibility rule ${index + 1}`}
                        >
                          <i className="fa fa-trash" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                  <button type="button" className="btn btn-outline-secondary ff-policy-add-rule-button" onClick={addEligibilityRule}>
                    <i className="fa fa-plus" aria-hidden="true" /> Add Eligibility Rule
                  </button>
                </div>
              )}
            </section>
            <section className="ff-policy-builder-section" aria-label="Scoring rule builder">
              <div>
                <h3>How should resources be ranked?</h3>
                <p>Add points when a resource matches a preferred condition. Higher scoring resources are offered first.</p>
              </div>
              {!hasSelectedResourceSet ? (
                <div className="ff-policy-field-gate">Choose a resource pool to load available ranking fields.</div>
              ) : (
                <div className="ff-policy-rule-stack">
                  {builderState.scoringRules.map((rule, index) => {
                    const operators = compatibleOperators(fieldTypeFor(rule.field));
                    return (
                      <div className="ff-policy-rule-row ff-policy-scoring-rule-row" key={rule.id}>
                        <label>
                          Scoring Field
                          <select
                            value={rule.field}
                            onChange={(event) =>
                              updateScoringRule(rule.id, {
                                field: event.target.value,
                                operator: ensureCompatibleOperator(event.target.value, rule.operator),
                              })
                            }
                          >
                            {resourceFieldOptions.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label} ({field.type})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Scoring Operator
                          <select value={rule.operator} onChange={(event) => updateScoringRule(rule.id, { operator: event.target.value })}>
                            {operators.map((operator) => (
                              <option key={operator.value} value={operator.value}>
                                {operator.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Scoring Value
                          <input
                            value={rule.value}
                            disabled={VALUELESS_OPERATORS.has(rule.operator)}
                            placeholder={rule.operator === "between" ? "1, 10" : index === 0 ? "0" : "Spanish"}
                            onChange={(event) => updateScoringRule(rule.id, { value: event.target.value })}
                          />
                        </label>
                        <label>
                          Score Weight
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={rule.scoreWeight}
                            onChange={(event) => updateScoringRule(rule.id, { scoreWeight: event.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-outline-secondary ff-policy-rule-remove"
                          disabled={builderState.scoringRules.length === 1}
                          onClick={() => removeScoringRule(rule.id)}
                          aria-label={`Remove scoring rule ${index + 1}`}
                        >
                          <i className="fa fa-trash" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                  <button type="button" className="btn btn-outline-secondary ff-policy-add-rule-button" onClick={addScoringRule}>
                    <i className="fa fa-plus" aria-hidden="true" /> Add Scoring Rule
                  </button>
                </div>
              )}
            </section>
            <section className="ff-policy-builder-section ff-policy-selection-section" aria-label="Fairness selection controls">
              <div>
                <h3>How should near matches be balanced?</h3>
                <p>
                  FlowForge still respects the best score, but rotates among near-equal resources so one person does not receive every offer.
                </p>
              </div>
              <div className="ff-policy-selection-grid">
                <label>
                  Fairness Window
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={builderState.fairnessWindowScoreDelta}
                    onChange={(event) => updateFairnessWindow(event.target.value.replace(/\D/g, ""))}
                    onKeyDown={(event) => {
                      if (["e", "E", "+", "-", "."].includes(event.key)) event.preventDefault();
                    }}
                  />
                </label>
                <div className="ff-policy-selection-explainer">
                  <strong>What this means</strong>
                  <p>
                    If the top score is 92 and this is set to {builderState.fairnessWindowScoreDelta || "0"}, resources scoring within that many points
                    can rotate based on workload and when they were last offered.
                  </p>
                </div>
              </div>
            </section>
            <details className="ff-policy-advanced">
              <summary>Advanced JSON and test data</summary>
              <div className="ff-policy-advanced-grid">
                <label className="ff-policy-toggle-row">
                  <input
                    type="checkbox"
                    checked={useAdvancedPolicyJson}
                    onChange={(event) => {
                      setUseAdvancedPolicyJson(event.target.checked);
                      if (event.target.checked) setPolicyJson(builtPolicyJson);
                    }}
                  />
                  Edit raw policy JSON instead of using the builder
                </label>
                {useAdvancedPolicyJson ? (
                  <label>
                    Matching Rules JSON
                    <textarea value={policyJson} onChange={(event) => setPolicyJson(event.target.value)} />
                  </label>
                ) : (
                  <div>
                    <strong>Generated policy JSON</strong>
                    {hasSelectedResourceSet ? (
                      <pre className="ff-json-preview">{builtPolicyJson}</pre>
                    ) : (
                      <div className="ff-policy-field-gate">Choose a resource pool to generate policy JSON from the builder.</div>
                    )}
                  </div>
                )}
                <label className="ff-policy-toggle-row">
                  <input type="checkbox" checked={useSavedResourceRecords} onChange={(event) => setUseSavedResourceRecords(event.target.checked)} />
                  Simulate against saved records from the selected resource set when available
                </label>
                <label>
                  Fallback Test Resources JSON
                  <textarea value={resourcesJson} onChange={(event) => setResourcesJson(event.target.value)} />
                </label>
              </div>
            </details>
            {error ? <div className="ff-empty-state">{error}</div> : null}
            <div className="ff-policy-actions">
              <button type="button" className="btn btn-outline-secondary" disabled={!hasSelectedResourceSet} onClick={() => simulationMutation.mutate()}>
                Simulate Policy
              </button>
              <button type="submit" className="btn btn-primary" disabled={createPolicyMutation.isPending || !hasSelectedResourceSet}>
                Save Policy
              </button>
            </div>
          </form>
          {simulationMutation.data ? (
            <section className="ff-policy-simulation" aria-label="Simulation result">
              <h2>Simulation Result</h2>
              <div className="ff-policy-simulation-grid">
                <article>
                  <span>Status</span>
                  <strong>{simulationMutation.data.valid ? "Valid" : "Needs attention"}</strong>
                </article>
                <article>
                  <span>Selected</span>
                  <strong>{candidateLabel(simulationMutation.data.selected_candidate)}</strong>
                </article>
                <article>
                  <span>Eligible</span>
                  <strong>{simulationMutation.data.eligible_candidates.length}</strong>
                </article>
                <article>
                  <span>Excluded</span>
                  <strong>{simulationMutation.data.excluded_candidates.length}</strong>
                </article>
              </div>
              {simulationMutation.data.no_match_reason ? <p className="ff-admin-helper">{simulationMutation.data.no_match_reason}</p> : null}
              <details className="ff-policy-simulation-details">
                <summary>View raw simulation details</summary>
                <pre className="ff-json-preview">{JSON.stringify(simulationMutation.data, null, 2)}</pre>
              </details>
            </section>
          ) : null}
            </>
          ) : (
          <div className="ff-policy-editor-placeholder">
            <span className="ff-policy-placeholder-icon">
              <i className="fa fa-route" aria-hidden="true" />
            </span>
            <h2>Select or Create a Policy</h2>
            <p>
              Open an existing policy from the list, or create a new policy when you are ready to define eligibility,
              scoring, AI drafting, and simulation rules.
            </p>
          </div>
          )}
        </main>

        <aside className="ff-policy-copilot ncqv2-ai-panel" aria-label="FlowForge AI Copilot">
          <div className="ncqv2-ai-panel-header">
            <div className="ncqv2-ai-brand">
              <h2 className="ncqv2-ai-title">
                <span className="ncqv2-ai-title-query">Flow</span>
                <span className="ncqv2-ai-title-forge">Forge</span>{" "}
                <span className="ncqv2-ai-title-ai">AI</span>
              </h2>
            </div>
          </div>
          <div className="ncqv2-ai-panel-body">
            <div className="ncqv2-ai-thread" aria-live="polite" ref={aiThreadRef}>
              {!aiHistory.length && !pendingPrompt ? (
                <div className="ncqv2-ai-empty-state">
                  <div className="small text-muted">Start a conversation to draft and refine matching policies.</div>
                </div>
              ) : null}

              {aiHistory.map((entry) => (
                <article key={entry.id} className="ncqv2-ai-turn">
                  <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
                    <div className="ncqv2-ai-bubble-label">You</div>
                    <div className="ncqv2-ai-bubble-text">{entry.prompt}</div>
                    <button
                      type="button"
                      className="btn btn-sm ncqv2-ai-copy-btn"
                      onClick={() => {
                        void copyPromptToClipboard(entry.prompt, `history-${entry.id}`);
                      }}
                      aria-label={copiedPromptKey === `history-${entry.id}` ? "Prompt copied" : "Copy prompt"}
                      title={copiedPromptKey === `history-${entry.id}` ? "Copied" : "Copy prompt"}
                    >
                      <i className={`fa ${copiedPromptKey === `history-${entry.id}` ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant">
                    <div className="ncqv2-ai-bubble-label">FlowForge AI</div>
                    <div className="ncqv2-ai-bubble-text">{entry.responseMessage}</div>
                    {entry.nextActions.length ? (
                      <section className="ncqv2-ai-next-actions" aria-label="Next actions">
                        <div className="ncqv2-ai-next-actions-title">Next actions</div>
                        <div className="ncqv2-ai-next-actions-list">
                          {entry.nextActions.map((nextAction, index) => (
                            <button
                              key={`${entry.id}-next-action-${index}`}
                              type="button"
                              className="ncqv2-ai-next-action-card"
                              onClick={() => {
                                if (nextAction.resourceSetId) setResourceSetId(String(nextAction.resourceSetId));
                                submitDraftPrompt(nextAction.prompt, { resourceSetId: nextAction.resourceSetId });
                              }}
                              disabled={draftPolicyMutation.isPending}
                              aria-label={`Run next action: ${nextAction.label}`}
                            >
                              <div className="ncqv2-ai-next-action-label">{nextAction.label}</div>
                              <div className="ncqv2-ai-next-action-reason">{nextAction.reason}</div>
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </article>
              ))}

              {draftPolicyMutation.isPending ? (
                <article className="ncqv2-ai-turn">
                  {pendingPrompt ? (
                    <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
                      <div className="ncqv2-ai-bubble-label">You</div>
                      <div className="ncqv2-ai-bubble-text">{pendingPrompt}</div>
                      <button
                        type="button"
                        className="btn btn-sm ncqv2-ai-copy-btn"
                        onClick={() => {
                          void copyPromptToClipboard(pendingPrompt, "pending");
                        }}
                        aria-label={copiedPromptKey === "pending" ? "Prompt copied" : "Copy prompt"}
                        title={copiedPromptKey === "pending" ? "Copied" : "Copy prompt"}
                      >
                        <i className={`fa ${copiedPromptKey === "pending" ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                  <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant ncqv2-ai-thinking-bubble" aria-live="polite" aria-label="Thinking">
                    <span className="ncqv2-ai-thinking-word">
                      {"Thinking".split("").map((char, index) => (
                        <span key={`flowforge-thinking-${index}`} className="ncqv2-ai-thinking-char" style={{ animationDelay: `${index * 80}ms` }}>
                          {char}
                        </span>
                      ))}
                    </span>
                    <span className="ncqv2-ai-thinking-dots">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  </div>
                </article>
              ) : null}
            </div>

            <div className="ncqv2-ai-composer">
              <form
                className="ncqv2-ai-goal"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draftPolicyMutation.isPending) {
                    stopDrafting();
                    return;
                  }
                  submitDraftPrompt();
                }}
              >
                <label htmlFor="flowforge-ai-goal" className="visually-hidden">
                  Goal
                </label>
                <div className="ncqv2-ai-goal-box">
                  <textarea
                    id="flowforge-ai-goal"
                    className="form-control ncqv2-ai-goal-input"
                    value={draftPrompt}
                    onChange={(event) => {
                      setDraftPrompt(event.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) return;
                      event.preventDefault();
                      if (draftPolicyMutation.isPending) {
                        stopDrafting();
                        return;
                      }
                      submitDraftPrompt();
                    }}
                    placeholder="Ask FlowForge AI to draft or edit your matching policy"
                    rows={3}
                  />
                  <div className="ncqv2-ai-composer-tools">
                    <button
                      type="button"
                      className="btn btn-sm ncqv2-ai-tool-btn"
                      onClick={clearAiHistory}
                      disabled={draftPolicyMutation.isPending || aiHistory.length === 0}
                      aria-label="Clear chat"
                      title="Clear chat"
                      data-tooltip="Clear chat"
                    >
                      <i className="fa fa-trash" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm ncqv2-ai-tool-btn"
                      onClick={startNewAiSession}
                      disabled={draftPolicyMutation.isPending}
                      aria-label="New session"
                      title="Start a new planning session"
                      data-tooltip="New session"
                    >
                      <i className="fa fa-rotate-right" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`ncqv2-ai-send-btn ${draftPolicyMutation.isPending ? "is-cancel" : ""}`}
                    disabled={!draftPolicyMutation.isPending && (!draftPrompt.trim() || !hasPolicyEditorOpen)}
                    onClick={handleAiSendButtonClick}
                    aria-label={draftPolicyMutation.isPending ? "Stop generating" : "Send"}
                    title={draftPolicyMutation.isPending ? "Stop generating" : "Send"}
                  >
                    <i className={`fa ${draftPolicyMutation.isPending ? "fa-stop" : "fa-arrow-up"}`} aria-hidden="true" />
                  </button>
                </div>
              </form>
              {hasPolicyEditorOpen && !hasSelectedResourceSet ? (
                <p className="ff-admin-helper ff-policy-ai-gate">Send a prompt and FlowForge AI will ask which resource pool to use.</p>
              ) : null}
              {!hasPolicyEditorOpen ? (
                <p className="ff-admin-helper ff-policy-ai-gate">Create or open a policy workspace before drafting with AI.</p>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
