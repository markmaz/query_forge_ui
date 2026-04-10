import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { fetchDomains } from "@/shared/services/queryStudioAdminApi";
import {
  useApprovePlannerRerankPolicyCandidate,
  useCreatePlannerRerankPolicyCandidate,
  useDeletePlannerDomainCapability,
  useDeletePlannerDomainSelectionPolicy,
  useDeletePlannerPromptIntentPolicy,
  useDeletePlannerProjectionPolicy,
  useDeletePlannerRetrievalPolicy,
  useDeletePlannerRerankPolicy,
  useDeletePlannerRerankPolicyCandidate,
  useDeletePlannerSignalPolicy,
  usePlannerDomainCapabilities,
  usePlannerDomainSelectionPolicies,
  usePlannerPromptIntentPolicies,
  usePlannerProjectionPolicies,
  usePlannerRetrievalPolicies,
  usePlannerRerankPolicies,
  usePlannerRerankPolicyCandidates,
  usePlannerSignalPolicies,
  useSuggestPlannerRerankPolicyCandidate,
  useUpsertPlannerDomainCapability,
  useUpsertPlannerDomainSelectionPolicy,
  useUpsertPlannerPromptIntentPolicy,
  useUpsertPlannerProjectionPolicy,
  useUpsertPlannerRetrievalPolicy,
  useUpsertPlannerRerankPolicy,
  useUpsertPlannerSignalPolicy,
} from "@/features/system-admin/hooks";
import type {
  PlannerDomainSelectionPolicyRow,
  PlannerDomainSelectionPolicyUpsertRequest,
  PlannerDomainCapabilityRow,
  PlannerDomainCapabilityUpsertRequest,
  PlannerPolicyCandidateReviewStatus,
  PlannerProjectionPolicyRow,
  PlannerProjectionPolicyUpsertRequest,
  PlannerPromptIntentPolicyRow,
  PlannerPromptIntentPolicyUpsertRequest,
  PlannerRetrievalPolicyRow,
  PlannerRetrievalPolicyUpsertRequest,
  PlannerRerankPolicyCandidateCreateRequest,
  PlannerRerankPolicyCandidateRow,
  PlannerRerankPolicyCandidateSuggestRequest,
  PlannerRerankPolicyRow,
  PlannerRerankPolicyUpsertRequest,
  PlannerSignalPolicyRow,
  PlannerSignalPolicyUpsertRequest,
} from "@/features/system-admin/types";

import { getDrawerFormId, getDrawerTitle } from "./constants";
import {
  clampUnit,
  defaultCandidateForm,
  defaultCapabilityForm,
  defaultDomainSelectionPolicyForm,
  defaultPolicyForm,
  defaultProjectionPolicyForm,
  defaultPromptIntentPolicyForm,
  defaultRetrievalPolicyForm,
  defaultSignalPolicyForm,
  defaultSuggestForm,
  domainSelectionRuleToForm,
  formToDomainSelectionRule,
  formToProjectionRule,
  formToPromptIntentRule,
  formToRetrievalRule,
  formToRule,
  formToSignalRule,
  humanizeKey,
  projectionRuleToForm,
  promptIntentRuleToForm,
  retrievalRuleToForm,
  ruleToForm,
  signalRuleToForm,
} from "./forms";
import type {
  CandidateFormState,
  CapabilityFormState,
  DeleteDialogState,
  DomainSelectionPolicyFormState,
  DrawerState,
  PlannerPoliciesTab,
  PolicyFormState,
  ProjectionPolicyFormState,
  PromptIntentPolicyFormState,
  RetrievalPolicyFormState,
  SignalPolicyFormState,
  SuggestFormState,
} from "./types";

export function usePlannerPoliciesPageState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [verticalNorm, setVerticalNorm] = useState(searchParams.get("vertical") || "education");
  const [includeInactive, setIncludeInactive] = useState(searchParams.get("inactive") === "1");
  const [candidateFilter, setCandidateFilter] = useState<PlannerPolicyCandidateReviewStatus | "">(
    (searchParams.get("candidate_status") as PlannerPolicyCandidateReviewStatus | "") || "pending",
  );
  const [activeTab, setActiveTab] = useState<PlannerPoliciesTab>(
    (searchParams.get("tab") as PlannerPoliciesTab) || "capabilities",
  );
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(
    Number(searchParams.get("domain_id") || "") || null,
  );

  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [capabilityForm, setCapabilityForm] = useState<CapabilityFormState>(defaultCapabilityForm());
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(defaultPolicyForm());
  const [projectionPolicyForm, setProjectionPolicyForm] = useState<ProjectionPolicyFormState>(defaultProjectionPolicyForm());
  const [signalPolicyForm, setSignalPolicyForm] = useState<SignalPolicyFormState>(defaultSignalPolicyForm());
  const [promptIntentPolicyForm, setPromptIntentPolicyForm] = useState<PromptIntentPolicyFormState>(defaultPromptIntentPolicyForm());
  const [retrievalPolicyForm, setRetrievalPolicyForm] = useState<RetrievalPolicyFormState>(defaultRetrievalPolicyForm());
  const [domainSelectionPolicyForm, setDomainSelectionPolicyForm] = useState<DomainSelectionPolicyFormState>(defaultDomainSelectionPolicyForm());
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(defaultCandidateForm());
  const [suggestForm, setSuggestForm] = useState<SuggestFormState>(defaultSuggestForm());

  const domainsQuery = useQuery({
    queryKey: ["admin", "domains", "planner-policies"],
    queryFn: fetchDomains,
    staleTime: 30_000,
  });

  const domains = useMemo(
    () => (domainsQuery.data?.rows ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [domainsQuery.data],
  );

  useEffect(() => {
    if (!selectedDomainId && domains.length > 0) {
      setSelectedDomainId(domains[0]?.id ?? null);
    }
  }, [domains, selectedDomainId]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedDomainId) next.set("domain_id", String(selectedDomainId));
    next.set("tab", activeTab);
    next.set("vertical", verticalNorm);
    if (candidateFilter) next.set("candidate_status", candidateFilter);
    if (includeInactive) next.set("inactive", "1");
    setSearchParams(next, { replace: true });
  }, [activeTab, candidateFilter, includeInactive, selectedDomainId, setSearchParams, verticalNorm]);

  const capabilitiesQuery = usePlannerDomainCapabilities(selectedDomainId, verticalNorm, includeInactive);
  const policiesQuery = usePlannerRerankPolicies(selectedDomainId, verticalNorm, includeInactive);
  const projectionPoliciesQuery = usePlannerProjectionPolicies(selectedDomainId, verticalNorm, includeInactive);
  const signalPoliciesQuery = usePlannerSignalPolicies(includeInactive);
  const promptIntentPoliciesQuery = usePlannerPromptIntentPolicies(includeInactive);
  const retrievalPoliciesQuery = usePlannerRetrievalPolicies(includeInactive);
  const domainSelectionPoliciesQuery = usePlannerDomainSelectionPolicies(includeInactive);
  const candidatesQuery = usePlannerRerankPolicyCandidates(candidateFilter, verticalNorm);

  const upsertCapability = useUpsertPlannerDomainCapability();
  const deleteCapability = useDeletePlannerDomainCapability();
  const upsertPolicy = useUpsertPlannerRerankPolicy();
  const deletePolicy = useDeletePlannerRerankPolicy();
  const upsertProjectionPolicy = useUpsertPlannerProjectionPolicy();
  const deleteProjectionPolicy = useDeletePlannerProjectionPolicy();
  const upsertSignalPolicy = useUpsertPlannerSignalPolicy();
  const deleteSignalPolicy = useDeletePlannerSignalPolicy();
  const upsertPromptIntentPolicy = useUpsertPlannerPromptIntentPolicy();
  const deletePromptIntentPolicy = useDeletePlannerPromptIntentPolicy();
  const upsertRetrievalPolicy = useUpsertPlannerRetrievalPolicy();
  const deleteRetrievalPolicy = useDeletePlannerRetrievalPolicy();
  const upsertDomainSelectionPolicy = useUpsertPlannerDomainSelectionPolicy();
  const deleteDomainSelectionPolicy = useDeletePlannerDomainSelectionPolicy();
  const saveCandidate = useCreatePlannerRerankPolicyCandidate();
  const deleteCandidate = useDeletePlannerRerankPolicyCandidate();
  const suggestCandidate = useSuggestPlannerRerankPolicyCandidate();
  const approveCandidate = useApprovePlannerRerankPolicyCandidate();

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId],
  );

  const drawerBusy =
    upsertCapability.isPending ||
    upsertPolicy.isPending ||
    upsertProjectionPolicy.isPending ||
    upsertSignalPolicy.isPending ||
    upsertPromptIntentPolicy.isPending ||
    upsertRetrievalPolicy.isPending ||
    upsertDomainSelectionPolicy.isPending ||
    saveCandidate.isPending ||
    suggestCandidate.isPending ||
    approveCandidate.isPending;

  const deleteBusy =
    deleteCapability.isPending ||
    deletePolicy.isPending ||
    deleteProjectionPolicy.isPending ||
    deleteSignalPolicy.isPending ||
    deletePromptIntentPolicy.isPending ||
    deleteRetrievalPolicy.isPending ||
    deleteDomainSelectionPolicy.isPending ||
    deleteCandidate.isPending;

  function closeDrawer() {
    setDrawerState(null);
  }

  function closeDeleteDialog() {
    setDeleteDialog(null);
  }

  function openCreateCapability() {
    setActiveTab("capabilities");
    setCapabilityForm(defaultCapabilityForm());
    setDrawerState({ kind: "capabilities", mode: "create" });
  }

  function openEditCapability(row: PlannerDomainCapabilityRow) {
    setActiveTab("capabilities");
    setCapabilityForm({
      id: row.id,
      capabilityKey: row.capability_key,
      scopeType: row.scope_type,
      supportLevel: row.support_level,
      sourceType: row.source_type,
      sourceRef: row.source_ref ?? "",
      confidence: String(row.confidence ?? 1),
      notes: row.notes ?? "",
      isActive: row.is_active,
    });
    setDrawerState({ kind: "capabilities", mode: "edit" });
  }

  function openCreatePolicy() {
    setActiveTab("policies");
    setPolicyForm(defaultPolicyForm());
    setDrawerState({ kind: "policies", mode: "create" });
  }

  function openEditPolicy(row: PlannerRerankPolicyRow) {
    setActiveTab("policies");
    setPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: ruleToForm(row.policy_json),
    });
    setDrawerState({ kind: "policies", mode: "edit" });
  }

  function openCreateProjectionPolicy() {
    setActiveTab("projection");
    setProjectionPolicyForm(defaultProjectionPolicyForm());
    setDrawerState({ kind: "projection", mode: "create" });
  }

  function openEditProjectionPolicy(row: PlannerProjectionPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("projection");
    setProjectionPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: projectionRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "projection", mode: "edit" });
  }

  function openCreateSignalPolicy() {
    setActiveTab("signal");
    setSignalPolicyForm(defaultSignalPolicyForm());
    setDrawerState({ kind: "signal", mode: "create" });
  }

  function openEditSignalPolicy(row: PlannerSignalPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("signal");
    setSignalPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: signalRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "signal", mode: "edit" });
  }

  function openCreatePromptIntentPolicy() {
    setActiveTab("prompt_intent");
    setPromptIntentPolicyForm(defaultPromptIntentPolicyForm());
    setDrawerState({ kind: "prompt_intent", mode: "create" });
  }

  function openEditPromptIntentPolicy(row: PlannerPromptIntentPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("prompt_intent");
    setPromptIntentPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: promptIntentRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "prompt_intent", mode: "edit" });
  }

  function openCreateRetrievalPolicy() {
    setActiveTab("retrieval");
    setRetrievalPolicyForm(defaultRetrievalPolicyForm());
    setDrawerState({ kind: "retrieval", mode: "create" });
  }

  function openEditRetrievalPolicy(row: PlannerRetrievalPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("retrieval");
    setRetrievalPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: retrievalRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "retrieval", mode: "edit" });
  }

  function openCreateDomainSelectionPolicy() {
    setActiveTab("domain_selection");
    setDomainSelectionPolicyForm(defaultDomainSelectionPolicyForm());
    setDrawerState({ kind: "domain_selection", mode: "create" });
  }

  function openEditDomainSelectionPolicy(row: PlannerDomainSelectionPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("domain_selection");
    setDomainSelectionPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: domainSelectionRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "domain_selection", mode: "edit" });
  }

  function openCreateCandidate() {
    setActiveTab("candidates");
    setCandidateForm(defaultCandidateForm());
    setDrawerState({ kind: "candidates", mode: "create" });
  }

  function openSuggestCandidate() {
    setActiveTab("candidates");
    setSuggestForm(defaultSuggestForm());
    setDrawerState({ kind: "candidate_suggest", mode: "create" });
  }

  function openEditCandidate(row: PlannerRerankPolicyCandidateRow) {
    setActiveTab("candidates");
    setCandidateForm({
      id: row.id,
      candidateKey: row.candidate_key,
      sourceType: row.source_type,
      confidence: String(row.confidence ?? 0.8),
      rationaleJson: row.rationale_json ? JSON.stringify(row.rationale_json, null, 2) : "",
      rule: ruleToForm(row.candidate_json),
    });
    setDrawerState({ kind: "candidates", mode: "edit" });
  }

  async function handleSaveCapability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const payload: PlannerDomainCapabilityUpsertRequest = {
      id: capabilityForm.id,
      scope_type: capabilityForm.scopeType,
      scope_vertical_norm: capabilityForm.scopeType.includes("vertical") ? verticalNorm.trim() || null : null,
      base_domain_id: selectedDomainId,
      capability_key: capabilityForm.capabilityKey,
      support_level: capabilityForm.supportLevel,
      source_type: capabilityForm.sourceType,
      source_ref: capabilityForm.sourceRef.trim() || null,
      confidence: clampUnit(Number(capabilityForm.confidence), 1),
      notes: capabilityForm.notes.trim() || null,
      is_active: capabilityForm.isActive,
    };
    try {
      await upsertCapability.mutateAsync(payload);
      toast.success(capabilityForm.id ? "Capability updated." : "Capability created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save capability.");
    }
  }

  async function handleSavePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const payload: PlannerRerankPolicyUpsertRequest = {
      id: policyForm.id,
      policy_key: policyForm.policyKey.trim(),
      name: policyForm.name.trim(),
      description: policyForm.description.trim() || null,
      scope_type: policyForm.scopeType,
      scope_vertical_norm: policyForm.scopeType.includes("vertical") ? verticalNorm.trim() || null : null,
      scope_base_domain_id: policyForm.scopeType.includes("domain") ? selectedDomainId : null,
      priority: Number(policyForm.priority) || 100,
      is_active: policyForm.isActive,
      stop_on_match: policyForm.stopOnMatch,
      policy_json: formToRule(policyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertPolicy.mutateAsync(payload);
      toast.success(policyForm.id ? "Policy updated." : "Policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save policy.");
    }
  }

  async function handleSaveProjectionPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const payload: PlannerProjectionPolicyUpsertRequest = {
      id: projectionPolicyForm.id,
      policy_key: projectionPolicyForm.policyKey.trim(),
      name: projectionPolicyForm.name.trim(),
      description: projectionPolicyForm.description.trim() || null,
      scope_type: projectionPolicyForm.scopeType,
      scope_vertical_norm: projectionPolicyForm.scopeType.includes("vertical") ? verticalNorm.trim() || null : null,
      scope_base_domain_id: projectionPolicyForm.scopeType.includes("domain") ? selectedDomainId : null,
      priority: Number(projectionPolicyForm.priority) || 100,
      is_active: projectionPolicyForm.isActive,
      stop_on_match: projectionPolicyForm.stopOnMatch,
      policy_json: formToProjectionRule(projectionPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertProjectionPolicy.mutateAsync(payload);
      toast.success(projectionPolicyForm.id ? "Projection policy updated." : "Projection policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save projection policy.");
    }
  }

  async function handleSaveSignalPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerSignalPolicyUpsertRequest = {
      id: signalPolicyForm.id,
      policy_key: signalPolicyForm.policyKey.trim(),
      name: signalPolicyForm.name.trim(),
      description: signalPolicyForm.description.trim() || null,
      scope_type: signalPolicyForm.scopeType,
      priority: Number(signalPolicyForm.priority) || 100,
      is_active: signalPolicyForm.isActive,
      stop_on_match: signalPolicyForm.stopOnMatch,
      policy_json: formToSignalRule(signalPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertSignalPolicy.mutateAsync(payload);
      toast.success(signalPolicyForm.id ? "Signal policy updated." : "Signal policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save signal policy.");
    }
  }

  async function handleSavePromptIntentPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerPromptIntentPolicyUpsertRequest = {
      id: promptIntentPolicyForm.id,
      policy_key: promptIntentPolicyForm.policyKey.trim(),
      name: promptIntentPolicyForm.name.trim(),
      description: promptIntentPolicyForm.description.trim() || null,
      scope_type: promptIntentPolicyForm.scopeType,
      priority: Number(promptIntentPolicyForm.priority) || 100,
      is_active: promptIntentPolicyForm.isActive,
      stop_on_match: promptIntentPolicyForm.stopOnMatch,
      policy_json: formToPromptIntentRule(promptIntentPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertPromptIntentPolicy.mutateAsync(payload);
      toast.success(promptIntentPolicyForm.id ? "Prompt intent policy updated." : "Prompt intent policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save prompt intent policy.");
    }
  }

  async function handleSaveRetrievalPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerRetrievalPolicyUpsertRequest = {
      id: retrievalPolicyForm.id,
      policy_key: retrievalPolicyForm.policyKey.trim(),
      name: retrievalPolicyForm.name.trim(),
      description: retrievalPolicyForm.description.trim() || null,
      scope_type: retrievalPolicyForm.scopeType,
      priority: Number(retrievalPolicyForm.priority) || 100,
      is_active: retrievalPolicyForm.isActive,
      stop_on_match: retrievalPolicyForm.stopOnMatch,
      policy_json: formToRetrievalRule(retrievalPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertRetrievalPolicy.mutateAsync(payload);
      toast.success(retrievalPolicyForm.id ? "Retrieval policy updated." : "Retrieval policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save retrieval policy.");
    }
  }

  async function handleSaveDomainSelectionPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerDomainSelectionPolicyUpsertRequest = {
      id: domainSelectionPolicyForm.id,
      policy_key: domainSelectionPolicyForm.policyKey.trim(),
      name: domainSelectionPolicyForm.name.trim(),
      description: domainSelectionPolicyForm.description.trim() || null,
      scope_type: domainSelectionPolicyForm.scopeType,
      priority: Number(domainSelectionPolicyForm.priority) || 100,
      is_active: domainSelectionPolicyForm.isActive,
      stop_on_match: domainSelectionPolicyForm.stopOnMatch,
      policy_json: formToDomainSelectionRule(domainSelectionPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertDomainSelectionPolicy.mutateAsync(payload);
      toast.success(domainSelectionPolicyForm.id ? "Domain selection policy updated." : "Domain selection policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save domain selection policy.");
    }
  }

  async function handleSaveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidateKey = candidateForm.candidateKey.trim();
    if (!candidateKey) {
      toast.error("Candidate key is required.");
      return;
    }
    let rationaleJson: Record<string, unknown> | null = null;
    if (candidateForm.rationaleJson.trim()) {
      try {
        const parsed = JSON.parse(candidateForm.rationaleJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Rationale JSON must be an object.");
        }
        rationaleJson = parsed as Record<string, unknown>;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Invalid rationale JSON.");
        return;
      }
    }
    const payload: PlannerRerankPolicyCandidateCreateRequest = {
      id: candidateForm.id,
      candidate_key: candidateKey,
      source_type: candidateForm.sourceType,
      vertical_norm: verticalNorm.trim() || null,
      candidate_policy: formToRule(candidateForm.rule),
      rationale_json: rationaleJson,
      confidence: clampUnit(Number(candidateForm.confidence), 0.8),
    };
    try {
      await saveCandidate.mutateAsync(payload);
      toast.success(candidateForm.id ? "Candidate updated." : "Candidate created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save candidate.");
    }
  }

  async function handleSuggestCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const prompt = suggestForm.prompt.trim();
    if (!prompt) {
      toast.error("Example prompt is required.");
      return;
    }
    const payload: PlannerRerankPolicyCandidateSuggestRequest = {
      prompt,
      vertical_norm: verticalNorm.trim() || null,
      expected_base_domain_id: selectedDomainId,
      observed_base_domain_id: Number(suggestForm.observedDomainId) || null,
      candidate_key: suggestForm.candidateKey.trim() || null,
      notes: suggestForm.notes.trim() || null,
    };
    try {
      const response = await suggestCandidate.mutateAsync(payload);
      toast.success(`AI candidate created: ${response.candidate.candidate_key}`);
      setCandidateFilter("pending");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to suggest candidate.");
    }
  }

  async function handleApproveCandidate(row: PlannerRerankPolicyCandidateRow) {
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    try {
      await approveCandidate.mutateAsync({
        candidateId: row.id,
        payload: {
          name: humanizeKey(row.candidate_key),
          policy_key: row.candidate_key,
          scope_type: "workspace_domain",
          scope_base_domain_id: selectedDomainId,
          scope_vertical_norm: verticalNorm.trim() || null,
        },
      });
      toast.success("Candidate approved into planner policy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve candidate.");
    }
  }

  function handleDeleteCapability(row: PlannerDomainCapabilityRow) {
    if (!row.id) return;
    setDeleteDialog({ kind: "capability", id: row.id, label: row.capability_key });
  }

  function handleDeletePolicy(row: PlannerRerankPolicyRow) {
    if (!row.id) return;
    setDeleteDialog({ kind: "policy", id: row.id, label: row.name });
  }

  function handleDeleteProjectionPolicy(row: PlannerProjectionPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "projection_policy", id: row.id, label: row.name });
  }

  function handleDeleteSignalPolicy(row: PlannerSignalPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "signal_policy", id: row.id, label: row.name });
  }

  function handleDeletePromptIntentPolicy(row: PlannerPromptIntentPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "prompt_intent_policy", id: row.id, label: row.name });
  }

  function handleDeleteRetrievalPolicy(row: PlannerRetrievalPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "retrieval_policy", id: row.id, label: row.name });
  }

  function handleDeleteDomainSelectionPolicy(row: PlannerDomainSelectionPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "domain_selection_policy", id: row.id, label: row.name });
  }

  function handleDeleteCandidate(row: PlannerRerankPolicyCandidateRow) {
    setDeleteDialog({ kind: "candidate", id: row.id, label: row.candidate_key });
  }

  async function handleConfirmDelete() {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.kind === "capability") {
        await deleteCapability.mutateAsync(deleteDialog.id);
        toast.success("Capability deleted.");
      } else if (deleteDialog.kind === "policy") {
        await deletePolicy.mutateAsync(deleteDialog.id);
        toast.success("Policy deleted.");
      } else if (deleteDialog.kind === "projection_policy") {
        await deleteProjectionPolicy.mutateAsync(deleteDialog.id);
        toast.success("Projection policy deleted.");
      } else if (deleteDialog.kind === "signal_policy") {
        await deleteSignalPolicy.mutateAsync(deleteDialog.id);
        toast.success("Signal policy deleted.");
      } else if (deleteDialog.kind === "prompt_intent_policy") {
        await deletePromptIntentPolicy.mutateAsync(deleteDialog.id);
        toast.success("Prompt intent policy deleted.");
      } else if (deleteDialog.kind === "retrieval_policy") {
        await deleteRetrievalPolicy.mutateAsync(deleteDialog.id);
        toast.success("Retrieval policy deleted.");
      } else if (deleteDialog.kind === "domain_selection_policy") {
        await deleteDomainSelectionPolicy.mutateAsync(deleteDialog.id);
        toast.success("Domain selection policy deleted.");
      } else {
        await deleteCandidate.mutateAsync(deleteDialog.id);
        toast.success("Candidate deleted.");
      }
      setDeleteDialog(null);
    } catch (error) {
      const fallback =
        deleteDialog.kind === "capability"
          ? "Unable to delete capability."
          : deleteDialog.kind === "policy"
            ? "Unable to delete policy."
            : deleteDialog.kind === "projection_policy"
              ? "Unable to delete projection policy."
              : deleteDialog.kind === "signal_policy"
                ? "Unable to delete signal policy."
                : deleteDialog.kind === "prompt_intent_policy"
                  ? "Unable to delete prompt intent policy."
                  : deleteDialog.kind === "retrieval_policy"
                    ? "Unable to delete retrieval policy."
                    : deleteDialog.kind === "domain_selection_policy"
                      ? "Unable to delete domain selection policy."
                      : "Unable to delete candidate.";
      toast.error(error instanceof Error ? error.message : fallback);
    }
  }

  const capabilities = capabilitiesQuery.data?.capabilities ?? [];
  const policies = policiesQuery.data?.policies ?? [];
  const projectionPolicies = projectionPoliciesQuery.data?.policies ?? [];
  const signalPolicies = signalPoliciesQuery.data?.policies ?? [];
  const promptIntentPolicies = promptIntentPoliciesQuery.data?.policies ?? [];
  const retrievalPolicies = retrievalPoliciesQuery.data?.policies ?? [];
  const domainSelectionPolicies = domainSelectionPoliciesQuery.data?.policies ?? [];
  const candidates = candidatesQuery.data?.candidates ?? [];

  const tabCounts = {
    capabilities: capabilities.length,
    policies: policies.length,
    projection: projectionPolicies.length,
    signal: signalPolicies.length,
    prompt_intent: promptIntentPolicies.length,
    retrieval: retrievalPolicies.length,
    domain_selection: domainSelectionPolicies.length,
    candidates: candidates.length,
  } satisfies Record<PlannerPoliciesTab, number>;

  const activeCount = tabCounts[activeTab];
  const drawerTitle = drawerState ? getDrawerTitle(drawerState) : "";
  const drawerFormId = drawerState ? getDrawerFormId(drawerState) : "";
  const drawerSubmitDisabled =
    drawerBusy ||
    Boolean(
      drawerState &&
      (drawerState.kind === "candidate_suggest" ||
        drawerState.kind === "capabilities" ||
        drawerState.kind === "policies" ||
        drawerState.kind === "projection") &&
      !selectedDomainId,
    );
  const drawerSubmitLabel =
    drawerBusy
      ? drawerState?.kind === "candidate_suggest"
        ? "Generating..."
        : "Saving..."
      : drawerState?.kind === "candidate_suggest"
        ? "Generate"
        : drawerState?.mode === "create"
          ? "Create"
          : "Save";

  return {
    verticalNorm,
    setVerticalNorm,
    includeInactive,
    setIncludeInactive,
    candidateFilter,
    setCandidateFilter,
    activeTab,
    setActiveTab,
    selectedDomainId,
    setSelectedDomainId,
    drawerState,
    deleteDialog,
    capabilityForm,
    setCapabilityForm,
    policyForm,
    setPolicyForm,
    projectionPolicyForm,
    setProjectionPolicyForm,
    signalPolicyForm,
    setSignalPolicyForm,
    promptIntentPolicyForm,
    setPromptIntentPolicyForm,
    retrievalPolicyForm,
    setRetrievalPolicyForm,
    domainSelectionPolicyForm,
    setDomainSelectionPolicyForm,
    candidateForm,
    setCandidateForm,
    suggestForm,
    setSuggestForm,
    domains,
    selectedDomain,
    capabilities,
    policies,
    projectionPolicies,
    signalPolicies,
    promptIntentPolicies,
    retrievalPolicies,
    domainSelectionPolicies,
    candidates,
    capabilitiesLoading: capabilitiesQuery.isLoading,
    policiesLoading: policiesQuery.isLoading,
    projectionPoliciesLoading: projectionPoliciesQuery.isLoading,
    signalPoliciesLoading: signalPoliciesQuery.isLoading,
    promptIntentPoliciesLoading: promptIntentPoliciesQuery.isLoading,
    retrievalPoliciesLoading: retrievalPoliciesQuery.isLoading,
    domainSelectionPoliciesLoading: domainSelectionPoliciesQuery.isLoading,
    candidatesLoading: candidatesQuery.isLoading,
    tabCounts,
    activeCount,
    drawerTitle,
    drawerFormId,
    drawerSubmitDisabled,
    drawerSubmitLabel,
    drawerBusy,
    deleteBusy,
    closeDrawer,
    closeDeleteDialog,
    openCreateCapability,
    openEditCapability,
    openCreatePolicy,
    openEditPolicy,
    openCreateProjectionPolicy,
    openEditProjectionPolicy,
    openCreateSignalPolicy,
    openEditSignalPolicy,
    openCreatePromptIntentPolicy,
    openEditPromptIntentPolicy,
    openCreateRetrievalPolicy,
    openEditRetrievalPolicy,
    openCreateDomainSelectionPolicy,
    openEditDomainSelectionPolicy,
    openCreateCandidate,
    openSuggestCandidate,
    openEditCandidate,
    handleSaveCapability,
    handleSavePolicy,
    handleSaveProjectionPolicy,
    handleSaveSignalPolicy,
    handleSavePromptIntentPolicy,
    handleSaveRetrievalPolicy,
    handleSaveDomainSelectionPolicy,
    handleSaveCandidate,
    handleSuggestCandidate,
    handleApproveCandidate,
    handleDeleteCapability,
    handleDeletePolicy,
    handleDeleteProjectionPolicy,
    handleDeleteSignalPolicy,
    handleDeletePromptIntentPolicy,
    handleDeleteRetrievalPolicy,
    handleDeleteDomainSelectionPolicy,
    handleDeleteCandidate,
    handleConfirmDelete,
  };
}
