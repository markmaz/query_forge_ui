import type { Dispatch, FormEvent, SetStateAction } from "react";

import type { Domain } from "@/shared/services/queryStudioAdminApi";
import { groupDomainRows, isWorkflowDomain } from "@/shared/domain/domainPresentation";
import type {
  PlannerPolicyCandidateSourceType,
  PlannerPolicyCapabilityKey,
  PlannerPolicyScopeType,
  PlannerPolicySourceType,
  PlannerPolicySupportLevel,
} from "@/features/system-admin/types";

import {
  CANDIDATE_SOURCE_OPTIONS,
  CAPABILITY_OPTIONS,
  GLOBAL_WORKSPACE_SCOPE_OPTIONS,
  SCOPE_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  SUPPORT_LEVEL_OPTIONS,
} from "../constants";
import {
  DomainSelectionRuleEditorFields,
  ProjectionRuleEditorFields,
  PromptIntentRuleEditorFields,
  RetrievalRuleEditorFields,
  RuleEditorFields,
  SignalRuleEditorFields,
} from "./PlannerPolicyRuleEditors";
import type {
  CandidateFormState,
  CapabilityFormState,
  DomainSelectionPolicyFormState,
  DrawerState,
  PolicyFormState,
  ProjectionPolicyFormState,
  PromptIntentPolicyFormState,
  RetrievalPolicyFormState,
  SignalPolicyFormState,
  SuggestFormState,
} from "../types";

type PlannerPoliciesDrawerFormsProps = {
  drawerState: Exclude<DrawerState, null>;
  capabilityForm: CapabilityFormState;
  setCapabilityForm: Dispatch<SetStateAction<CapabilityFormState>>;
  policyForm: PolicyFormState;
  setPolicyForm: Dispatch<SetStateAction<PolicyFormState>>;
  projectionPolicyForm: ProjectionPolicyFormState;
  setProjectionPolicyForm: Dispatch<SetStateAction<ProjectionPolicyFormState>>;
  signalPolicyForm: SignalPolicyFormState;
  setSignalPolicyForm: Dispatch<SetStateAction<SignalPolicyFormState>>;
  promptIntentPolicyForm: PromptIntentPolicyFormState;
  setPromptIntentPolicyForm: Dispatch<SetStateAction<PromptIntentPolicyFormState>>;
  retrievalPolicyForm: RetrievalPolicyFormState;
  setRetrievalPolicyForm: Dispatch<SetStateAction<RetrievalPolicyFormState>>;
  domainSelectionPolicyForm: DomainSelectionPolicyFormState;
  setDomainSelectionPolicyForm: Dispatch<SetStateAction<DomainSelectionPolicyFormState>>;
  candidateForm: CandidateFormState;
  setCandidateForm: Dispatch<SetStateAction<CandidateFormState>>;
  suggestForm: SuggestFormState;
  setSuggestForm: Dispatch<SetStateAction<SuggestFormState>>;
  domains: Domain[];
  selectedDomainId: number | null;
  selectedDomainName: string | null;
  handleSaveCapability: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSavePolicy: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSaveProjectionPolicy: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSaveSignalPolicy: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSavePromptIntentPolicy: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSaveRetrievalPolicy: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSaveDomainSelectionPolicy: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSaveCandidate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSuggestCandidate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function PlannerPoliciesDrawerForms({
  drawerState,
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
  selectedDomainId,
  selectedDomainName,
  handleSaveCapability,
  handleSavePolicy,
  handleSaveProjectionPolicy,
  handleSaveSignalPolicy,
  handleSavePromptIntentPolicy,
  handleSaveRetrievalPolicy,
  handleSaveDomainSelectionPolicy,
  handleSaveCandidate,
  handleSuggestCandidate,
}: PlannerPoliciesDrawerFormsProps) {
  const observedWrongDomainGroups = groupDomainRows(domains.filter((domain) => domain.id !== selectedDomainId));

  if (drawerState.kind === "capabilities") {
    return (
      <form id="planner-policies-capabilities-form" onSubmit={handleSaveCapability}>
        <div className="sa-drawer-form-card">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="capability-key">Capability</label>
              <select
                id="capability-key"
                className="form-select"
                value={capabilityForm.capabilityKey}
                onChange={(event) =>
                  setCapabilityForm((prev) => ({ ...prev, capabilityKey: event.target.value as PlannerPolicyCapabilityKey }))
                }
              >
                {CAPABILITY_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="capability-scope">Scope</label>
              <select
                id="capability-scope"
                className="form-select"
                value={capabilityForm.scopeType}
                onChange={(event) =>
                  setCapabilityForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))
                }
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="capability-support">Support Level</label>
              <select
                id="capability-support"
                className="form-select"
                value={capabilityForm.supportLevel}
                onChange={(event) =>
                  setCapabilityForm((prev) => ({ ...prev, supportLevel: event.target.value as PlannerPolicySupportLevel }))
                }
              >
                {SUPPORT_LEVEL_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="capability-source-type">Source Type</label>
              <select
                id="capability-source-type"
                className="form-select"
                value={capabilityForm.sourceType}
                onChange={(event) =>
                  setCapabilityForm((prev) => ({ ...prev, sourceType: event.target.value as PlannerPolicySourceType }))
                }
              >
                {SOURCE_TYPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="capability-source-ref">Source Ref</label>
              <input
                id="capability-source-ref"
                className="form-control"
                value={capabilityForm.sourceRef}
                onChange={(event) => setCapabilityForm((prev) => ({ ...prev, sourceRef: event.target.value }))}
                placeholder="semantic concept or source column"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="capability-confidence">Confidence</label>
              <input
                id="capability-confidence"
                className="form-control"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={capabilityForm.confidence}
                onChange={(event) => setCapabilityForm((prev) => ({ ...prev, confidence: event.target.value }))}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check mb-2">
                <input
                  id="capability-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={capabilityForm.isActive}
                  onChange={(event) => setCapabilityForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="capability-active">Active</label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="capability-notes">Notes</label>
              <textarea
                id="capability-notes"
                className="form-control"
                rows={4}
                value={capabilityForm.notes}
                onChange={(event) => setCapabilityForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>
        </div>
      </form>
    );
  }

  if (drawerState.kind === "policies") {
    return (
      <form id="planner-policies-policies-form" onSubmit={handleSavePolicy}>
        <div className="sa-drawer-form-card">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="policy-name">Name</label>
              <input
                id="policy-name"
                className="form-control"
                value={policyForm.name}
                onChange={(event) => setPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="policy-key">Policy Key</label>
              <input
                id="policy-key"
                className="form-control"
                value={policyForm.policyKey}
                onChange={(event) => setPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="policy-scope">Scope</label>
              <select
                id="policy-scope"
                className="form-select"
                value={policyForm.scopeType}
                onChange={(event) => setPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))}
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="policy-priority">Priority</label>
              <input
                id="policy-priority"
                className="form-control"
                type="number"
                value={policyForm.priority}
                onChange={(event) => setPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check mb-2 me-3">
                <input
                  id="policy-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={policyForm.isActive}
                  onChange={(event) => setPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="policy-active">Active</label>
              </div>
              <div className="form-check mb-2">
                <input
                  id="policy-stop-on-match"
                  className="form-check-input"
                  type="checkbox"
                  checked={policyForm.stopOnMatch}
                  onChange={(event) => setPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="policy-stop-on-match">Stop On Match</label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="policy-description">Description</label>
              <textarea
                id="policy-description"
                className="form-control"
                rows={3}
                value={policyForm.description}
                onChange={(event) => setPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <RuleEditorFields
            prefix="policy"
            value={policyForm.rule}
            onChange={(next) => setPolicyForm((prev) => ({ ...prev, rule: next }))}
          />
        </div>
      </form>
    );
  }

  if (drawerState.kind === "projection") {
    return (
      <form id="planner-policies-projection-form" onSubmit={handleSaveProjectionPolicy}>
        <div className="sa-drawer-form-card">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="projection-policy-name">Name</label>
              <input
                id="projection-policy-name"
                className="form-control"
                value={projectionPolicyForm.name}
                onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="projection-policy-key">Policy Key</label>
              <input
                id="projection-policy-key"
                className="form-control"
                value={projectionPolicyForm.policyKey}
                onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="projection-policy-scope">Scope</label>
              <select
                id="projection-policy-scope"
                className="form-select"
                value={projectionPolicyForm.scopeType}
                onChange={(event) =>
                  setProjectionPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))
                }
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="projection-policy-priority">Priority</label>
              <input
                id="projection-policy-priority"
                className="form-control"
                type="number"
                value={projectionPolicyForm.priority}
                onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check mb-2 me-3">
                <input
                  id="projection-policy-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={projectionPolicyForm.isActive}
                  onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="projection-policy-active">Active</label>
              </div>
              <div className="form-check mb-2">
                <input
                  id="projection-policy-stop-on-match"
                  className="form-check-input"
                  type="checkbox"
                  checked={projectionPolicyForm.stopOnMatch}
                  onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="projection-policy-stop-on-match">Stop On Match</label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="projection-policy-description">Description</label>
              <textarea
                id="projection-policy-description"
                className="form-control"
                rows={3}
                value={projectionPolicyForm.description}
                onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <ProjectionRuleEditorFields
            prefix="projection-policy"
            value={projectionPolicyForm.rule}
            onChange={(next) => setProjectionPolicyForm((prev) => ({ ...prev, rule: next }))}
          />
        </div>
      </form>
    );
  }

  if (drawerState.kind === "signal") {
    return (
      <form id="planner-policies-signal-form" onSubmit={handleSaveSignalPolicy}>
        <div className="sa-drawer-form-card">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="signal-policy-name">Name</label>
              <input
                id="signal-policy-name"
                className="form-control"
                value={signalPolicyForm.name}
                onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="signal-policy-key">Policy Key</label>
              <input
                id="signal-policy-key"
                className="form-control"
                value={signalPolicyForm.policyKey}
                onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="signal-policy-scope">Scope</label>
              <select
                id="signal-policy-scope"
                className="form-select"
                value={signalPolicyForm.scopeType}
                onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))}
              >
                {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="signal-policy-priority">Priority</label>
              <input
                id="signal-policy-priority"
                className="form-control"
                type="number"
                value={signalPolicyForm.priority}
                onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check mb-2 me-3">
                <input
                  id="signal-policy-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={signalPolicyForm.isActive}
                  onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="signal-policy-active">Active</label>
              </div>
              <div className="form-check mb-2">
                <input
                  id="signal-policy-stop-on-match"
                  className="form-check-input"
                  type="checkbox"
                  checked={signalPolicyForm.stopOnMatch}
                  onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="signal-policy-stop-on-match">Stop On Match</label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="signal-policy-description">Description</label>
              <textarea
                id="signal-policy-description"
                className="form-control"
                rows={3}
                value={signalPolicyForm.description}
                onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <SignalRuleEditorFields
            prefix="signal-policy"
            value={signalPolicyForm.rule}
            onChange={(next) => setSignalPolicyForm((prev) => ({ ...prev, rule: next }))}
          />
        </div>
      </form>
    );
  }

  if (drawerState.kind === "prompt_intent") {
    return (
      <form id="planner-policies-prompt-intent-form" onSubmit={handleSavePromptIntentPolicy}>
        <div className="sa-drawer-form-card">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="prompt-intent-policy-name">Name</label>
              <input
                id="prompt-intent-policy-name"
                className="form-control"
                value={promptIntentPolicyForm.name}
                onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="prompt-intent-policy-key">Policy Key</label>
              <input
                id="prompt-intent-policy-key"
                className="form-control"
                value={promptIntentPolicyForm.policyKey}
                onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="prompt-intent-policy-scope">Scope</label>
              <select
                id="prompt-intent-policy-scope"
                className="form-select"
                value={promptIntentPolicyForm.scopeType}
                onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))}
              >
                {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="prompt-intent-policy-priority">Priority</label>
              <input
                id="prompt-intent-policy-priority"
                className="form-control"
                type="number"
                value={promptIntentPolicyForm.priority}
                onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check mb-2 me-3">
                <input
                  id="prompt-intent-policy-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={promptIntentPolicyForm.isActive}
                  onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="prompt-intent-policy-active">Active</label>
              </div>
              <div className="form-check mb-2">
                <input
                  id="prompt-intent-policy-stop-on-match"
                  className="form-check-input"
                  type="checkbox"
                  checked={promptIntentPolicyForm.stopOnMatch}
                  onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="prompt-intent-policy-stop-on-match">Stop On Match</label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="prompt-intent-policy-description">Description</label>
              <textarea
                id="prompt-intent-policy-description"
                className="form-control"
                rows={3}
                value={promptIntentPolicyForm.description}
                onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <PromptIntentRuleEditorFields
            prefix="prompt-intent-policy"
            value={promptIntentPolicyForm.rule}
            onChange={(next) => setPromptIntentPolicyForm((prev) => ({ ...prev, rule: next }))}
          />
        </div>
      </form>
    );
  }

  if (drawerState.kind === "retrieval") {
    return (
      <form id="planner-policies-retrieval-form" onSubmit={handleSaveRetrievalPolicy}>
        <div className="sa-drawer-form-card">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="retrieval-policy-name">Name</label>
              <input
                id="retrieval-policy-name"
                className="form-control"
                value={retrievalPolicyForm.name}
                onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="retrieval-policy-key">Policy Key</label>
              <input
                id="retrieval-policy-key"
                className="form-control"
                value={retrievalPolicyForm.policyKey}
                onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="retrieval-policy-scope">Scope</label>
              <select
                id="retrieval-policy-scope"
                className="form-select"
                value={retrievalPolicyForm.scopeType}
                onChange={(event) =>
                  setRetrievalPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))
                }
              >
                {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="retrieval-policy-priority">Priority</label>
              <input
                id="retrieval-policy-priority"
                className="form-control"
                type="number"
                value={retrievalPolicyForm.priority}
                onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check mb-2 me-3">
                <input
                  id="retrieval-policy-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={retrievalPolicyForm.isActive}
                  onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="retrieval-policy-active">Active</label>
              </div>
              <div className="form-check mb-2">
                <input
                  id="retrieval-policy-stop-on-match"
                  className="form-check-input"
                  type="checkbox"
                  checked={retrievalPolicyForm.stopOnMatch}
                  onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                />
                <label className="form-check-label" htmlFor="retrieval-policy-stop-on-match">Stop On Match</label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="retrieval-policy-description">Description</label>
              <textarea
                id="retrieval-policy-description"
                className="form-control"
                rows={3}
                value={retrievalPolicyForm.description}
                onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <RetrievalRuleEditorFields
            prefix="retrieval-policy"
            value={retrievalPolicyForm.rule}
            onChange={(next) => setRetrievalPolicyForm((prev) => ({ ...prev, rule: next }))}
          />
        </div>
      </form>
    );
  }

  if (drawerState.kind === "domain_selection") {
    return (
      <form id="planner-policies-domain-selection-form" onSubmit={handleSaveDomainSelectionPolicy}>
        <div className="sa-drawer-form-card">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="domain-selection-policy-name">Name</label>
              <input
                id="domain-selection-policy-name"
                className="form-control"
                value={domainSelectionPolicyForm.name}
                onChange={(event) =>
                  setDomainSelectionPolicyForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="domain-selection-policy-key">Policy Key</label>
              <input
                id="domain-selection-policy-key"
                className="form-control"
                value={domainSelectionPolicyForm.policyKey}
                onChange={(event) =>
                  setDomainSelectionPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))
                }
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="domain-selection-policy-scope">Scope</label>
              <select
                id="domain-selection-policy-scope"
                className="form-select"
                value={domainSelectionPolicyForm.scopeType}
                onChange={(event) =>
                  setDomainSelectionPolicyForm((prev) => ({
                    ...prev,
                    scopeType: event.target.value as PlannerPolicyScopeType,
                  }))
                }
              >
                {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="domain-selection-policy-priority">Priority</label>
              <input
                id="domain-selection-policy-priority"
                className="form-control"
                type="number"
                value={domainSelectionPolicyForm.priority}
                onChange={(event) =>
                  setDomainSelectionPolicyForm((prev) => ({ ...prev, priority: event.target.value }))
                }
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check mb-2 me-3">
                <input
                  id="domain-selection-policy-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={domainSelectionPolicyForm.isActive}
                  onChange={(event) =>
                    setDomainSelectionPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                <label className="form-check-label" htmlFor="domain-selection-policy-active">Active</label>
              </div>
              <div className="form-check mb-2">
                <input
                  id="domain-selection-policy-stop-on-match"
                  className="form-check-input"
                  type="checkbox"
                  checked={domainSelectionPolicyForm.stopOnMatch}
                  onChange={(event) =>
                    setDomainSelectionPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))
                  }
                />
                <label className="form-check-label" htmlFor="domain-selection-policy-stop-on-match">Stop On Match</label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="domain-selection-policy-description">Description</label>
              <textarea
                id="domain-selection-policy-description"
                className="form-control"
                rows={3}
                value={domainSelectionPolicyForm.description}
                onChange={(event) =>
                  setDomainSelectionPolicyForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
          </div>
          <DomainSelectionRuleEditorFields
            prefix="domain-selection-policy"
            value={domainSelectionPolicyForm.rule}
            onChange={(next) => setDomainSelectionPolicyForm((prev) => ({ ...prev, rule: next }))}
          />
        </div>
      </form>
    );
  }

  if (drawerState.kind === "candidates") {
    return (
      <form id="planner-policies-candidates-form" onSubmit={handleSaveCandidate}>
        <div className="sa-drawer-form-card">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="candidate-key">Candidate Key</label>
              <input
                id="candidate-key"
                className="form-control"
                value={candidateForm.candidateKey}
                onChange={(event) => setCandidateForm((prev) => ({ ...prev, candidateKey: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="candidate-source-type">Source Type</label>
              <select
                id="candidate-source-type"
                className="form-select"
                value={candidateForm.sourceType}
                onChange={(event) =>
                  setCandidateForm((prev) => ({ ...prev, sourceType: event.target.value as PlannerPolicyCandidateSourceType }))
                }
              >
                {CANDIDATE_SOURCE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="candidate-confidence">Confidence</label>
              <input
                id="candidate-confidence"
                className="form-control"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={candidateForm.confidence}
                onChange={(event) => setCandidateForm((prev) => ({ ...prev, confidence: event.target.value }))}
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="candidate-rationale">Rationale JSON</label>
              <textarea
                id="candidate-rationale"
                className="form-control font-monospace"
                rows={6}
                value={candidateForm.rationaleJson}
                onChange={(event) => setCandidateForm((prev) => ({ ...prev, rationaleJson: event.target.value }))}
                placeholder='{"prompt":"Show students at Barksdale Elementary"}'
              />
            </div>
          </div>
          <RuleEditorFields
            prefix="candidate"
            value={candidateForm.rule}
            onChange={(next) => setCandidateForm((prev) => ({ ...prev, rule: next }))}
          />
        </div>
      </form>
    );
  }

  return (
    <form id="planner-policies-candidate-suggest-form" onSubmit={handleSuggestCandidate}>
      <div className="sa-drawer-form-card">
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label" htmlFor="suggest-prompt">Example Prompt</label>
            <textarea
              id="suggest-prompt"
              className="form-control"
              rows={5}
              value={suggestForm.prompt}
              onChange={(event) => setSuggestForm((prev) => ({ ...prev, prompt: event.target.value }))}
              placeholder="Show me all the students enrolled at Barksdale Elementary"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="suggest-observed-domain">Observed Wrong Domain</label>
            <select
              id="suggest-observed-domain"
              className="form-select"
              value={suggestForm.observedDomainId}
              onChange={(event) => setSuggestForm((prev) => ({ ...prev, observedDomainId: event.target.value }))}
            >
              <option value="">None</option>
              {observedWrongDomainGroups.map((group) => (
                <optgroup label={group.label} key={`suggest-domain-group-${group.key}`}>
                  {group.rows.map((domain) => (
                    <option value={domain.id} key={`suggest-domain-${domain.id}`}>
                      {isWorkflowDomain(domain) ? `Workflow - ${domain.name}` : domain.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="form-text">Optional. Use this when planner picked the wrong domain and you want AI to compare the capability gap.</div>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="suggest-candidate-key">Candidate Key Override</label>
            <input
              id="suggest-candidate-key"
              className="form-control"
              value={suggestForm.candidateKey}
              onChange={(event) => setSuggestForm((prev) => ({ ...prev, candidateKey: event.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="suggest-notes">Notes</label>
            <textarea
              id="suggest-notes"
              className="form-control"
              rows={4}
              value={suggestForm.notes}
              onChange={(event) => setSuggestForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Optional context for why this prompt should favor the selected domain."
            />
          </div>
          <div className="col-12">
            <div className="small text-muted">
              Target domain: <strong>{selectedDomainName ?? "Select a domain first"}</strong>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
