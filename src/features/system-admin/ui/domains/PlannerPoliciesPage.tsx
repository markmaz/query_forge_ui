import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { fetchDomains, type Domain } from "@/shared/services/queryStudioAdminApi";
import {
  useApprovePlannerRerankPolicyCandidate,
  useCreatePlannerRerankPolicyCandidate,
  useDeletePlannerDomainCapability,
  useDeletePlannerRerankPolicy,
  useDeletePlannerRerankPolicyCandidate,
  usePlannerDomainCapabilities,
  usePlannerRerankPolicies,
  usePlannerRerankPolicyCandidates,
  useSuggestPlannerRerankPolicyCandidate,
  useUpsertPlannerDomainCapability,
  useUpsertPlannerRerankPolicy,
} from "@/features/system-admin/hooks";
import type {
  PlannerDomainCapabilityRow,
  PlannerDomainCapabilityUpsertRequest,
  PlannerPolicyCandidateReviewStatus,
  PlannerPolicyCandidateSourceType,
  PlannerPolicyCapabilityKey,
  PlannerPolicyScopeType,
  PlannerPolicySignalKey,
  PlannerPolicySourceType,
  PlannerPolicySupportLevel,
  PlannerRerankPolicyCandidateCreateRequest,
  PlannerRerankPolicyCandidateSuggestRequest,
  PlannerRerankPolicyCandidateRow,
  PlannerRerankPolicyRow,
  PlannerRerankPolicyRule,
  PlannerRerankPolicyUpsertRequest,
} from "@/features/system-admin/types";
import "../systemAdmin.css";

type PlannerPoliciesTab = "capabilities" | "policies" | "candidates";

type RuleFormState = {
  whenSignalsAll: PlannerPolicySignalKey[];
  whenSignalsAny: PlannerPolicySignalKey[];
  excludeSignalsAny: PlannerPolicySignalKey[];
  preferCapabilities: PlannerPolicyCapabilityKey[];
  penalizeMissing: PlannerPolicyCapabilityKey[];
  requireForBonus: PlannerPolicyCapabilityKey[];
  boost: string;
  penalty: string;
  maxEffect: string;
};

type CapabilityFormState = {
  id?: number;
  capabilityKey: PlannerPolicyCapabilityKey;
  scopeType: PlannerPolicyScopeType;
  supportLevel: PlannerPolicySupportLevel;
  sourceType: PlannerPolicySourceType;
  sourceRef: string;
  confidence: string;
  notes: string;
  isActive: boolean;
};

type PolicyFormState = {
  id?: number;
  policyKey: string;
  name: string;
  description: string;
  scopeType: PlannerPolicyScopeType;
  priority: string;
  isActive: boolean;
  stopOnMatch: boolean;
  rule: RuleFormState;
};

type CandidateFormState = {
  id?: number;
  candidateKey: string;
  sourceType: PlannerPolicyCandidateSourceType;
  confidence: string;
  rationaleJson: string;
  rule: RuleFormState;
};

type SuggestFormState = {
  prompt: string;
  observedDomainId: string;
  candidateKey: string;
  notes: string;
};

type DrawerState =
  | { kind: "capabilities"; mode: "create" | "edit" }
  | { kind: "policies"; mode: "create" | "edit" }
  | { kind: "candidates"; mode: "create" | "edit" }
  | { kind: "candidate_suggest"; mode: "create" }
  | null;

type DeleteDialogState =
  | { kind: "capability"; id: number; label: string }
  | { kind: "policy"; id: number; label: string }
  | { kind: "candidate"; id: number; label: string }
  | null;

const TABS: { key: PlannerPoliciesTab; label: string }[] = [
  { key: "capabilities", label: "Capabilities" },
  { key: "policies", label: "Policies" },
  { key: "candidates", label: "Candidates" },
];

const CAPABILITY_OPTIONS: PlannerPolicyCapabilityKey[] = [
  "STUDENT_IDENTITY",
  "BIRTH_DATE",
  "AGE",
  "STAFF_IDENTITY",
  "SCHOOL_IDENTITY",
  "SCHOOL_NAME",
  "CALENDAR_DATE",
  "SCHOOL_DAY_FLAG",
  "NON_INSTRUCTIONAL_DAY",
  "DISTRICT_NAME",
  "ENROLLMENT_STATUS",
  "PROGRAM_MEMBERSHIP",
  "STAFF_ROLE",
  "GRADE_LEVEL",
  "RACE_ETHNICITY",
  "GENDER",
  "STUDENT_COUNT",
  "ENROLLMENT_COUNT",
  "ATTENDANCE_RATE",
  "COURSE_GRADE",
  "DISCIPLINE_INCIDENT_COUNT",
];

const SIGNAL_OPTIONS: PlannerPolicySignalKey[] = [
  "student_listing",
  "student_aggregate",
  "staff_listing",
  "staff_aggregate",
  "school_aggregate",
  "age_extreme_prompt",
  "birth_month_prompt",
  "calendar_days_off_prompt",
  "school_literal_present",
  "district_literal_present",
  "time_constraint_present",
  "status_enrolled",
  "status_active",
  "subgroup_prompt",
  "program_prompt",
  "staff_role_prompt",
  "needs_student_identity",
  "needs_school_filter",
  "needs_enrollment_status",
  "needs_attendance_metric",
  "needs_grade_metric",
  "needs_program_membership",
  "listing_intent",
  "aggregate_intent",
  "grouped_aggregate",
];

const SCOPE_OPTIONS: PlannerPolicyScopeType[] = [
  "workspace_domain",
  "workspace",
  "vertical_domain",
  "vertical",
  "global_domain",
  "global",
];

const SUPPORT_LEVEL_OPTIONS: PlannerPolicySupportLevel[] = ["direct", "derived", "partial"];
const SOURCE_TYPE_OPTIONS: PlannerPolicySourceType[] = [
  "semantic_concept",
  "dimension",
  "filter",
  "metric",
  "derived_condition",
  "heuristic_inference",
];
const CANDIDATE_SOURCE_OPTIONS: PlannerPolicyCandidateSourceType[] = [
  "manual",
  "ai_recommendation",
  "trace_review",
];
const CANDIDATE_REVIEW_FILTERS: Array<PlannerPolicyCandidateReviewStatus | ""> = ["", "pending", "approved", "rejected"];

function defaultRuleForm(): RuleFormState {
  return {
    whenSignalsAll: [],
    whenSignalsAny: [],
    excludeSignalsAny: [],
    preferCapabilities: [],
    penalizeMissing: [],
    requireForBonus: [],
    boost: "0.20",
    penalty: "0.20",
    maxEffect: "0.30",
  };
}

function defaultCapabilityForm(): CapabilityFormState {
  return {
    capabilityKey: "SCHOOL_NAME",
    scopeType: "workspace_domain",
    supportLevel: "direct",
    sourceType: "semantic_concept",
    sourceRef: "",
    confidence: "1.0",
    notes: "",
    isActive: true,
  };
}

function defaultPolicyForm(): PolicyFormState {
  return {
    policyKey: "",
    name: "",
    description: "",
    scopeType: "workspace_domain",
    priority: "100",
    isActive: true,
    stopOnMatch: false,
    rule: defaultRuleForm(),
  };
}

function defaultCandidateForm(): CandidateFormState {
  return {
    candidateKey: "",
    sourceType: "manual",
    confidence: "0.8",
    rationaleJson: "",
    rule: defaultRuleForm(),
  };
}

function defaultSuggestForm(): SuggestFormState {
  return {
    prompt: "",
    observedDomainId: "",
    candidateKey: "",
    notes: "",
  };
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function dedupeValues<T extends string>(values: readonly T[] | null | undefined): T[] {
  return Array.from(new Set(values ?? [])) as T[];
}

function clampUnit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function ruleToForm(rule?: PlannerRerankPolicyRule | null): RuleFormState {
  return {
    whenSignalsAll: dedupeValues(rule?.when_signals_all),
    whenSignalsAny: dedupeValues(rule?.when_signals_any),
    excludeSignalsAny: dedupeValues(rule?.exclude_signals_any),
    preferCapabilities: dedupeValues(rule?.prefer_capabilities),
    penalizeMissing: dedupeValues(rule?.penalize_missing),
    requireForBonus: dedupeValues(rule?.require_for_bonus),
    boost: String(rule?.boost ?? 0.2),
    penalty: String(rule?.penalty ?? 0.2),
    maxEffect: String(rule?.max_effect ?? 0.3),
  };
}

function formToRule(form: RuleFormState): PlannerRerankPolicyRule {
  return {
    version: 1,
    when_signals_all: dedupeValues(form.whenSignalsAll),
    when_signals_any: dedupeValues(form.whenSignalsAny),
    exclude_signals_any: dedupeValues(form.excludeSignalsAny),
    prefer_capabilities: dedupeValues(form.preferCapabilities).map((entry) => entry.toUpperCase()) as PlannerPolicyCapabilityKey[],
    penalize_missing: dedupeValues(form.penalizeMissing).map((entry) => entry.toUpperCase()) as PlannerPolicyCapabilityKey[],
    require_for_bonus: dedupeValues(form.requireForBonus).map((entry) => entry.toUpperCase()) as PlannerPolicyCapabilityKey[],
    boost: clampUnit(Number(form.boost), 0),
    penalty: clampUnit(Number(form.penalty), 0),
    max_effect: clampUnit(Number(form.maxEffect), 0.3),
  };
}

function MultiSelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: T[];
  options: readonly T[];
  onChange: (next: T[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selected = dedupeValues(value);
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map(humanizeKey).join(", ")
        : `${selected.length} selected`;

  function toggleOption(option: T) {
    if (selected.includes(option)) {
      onChange(selected.filter((entry) => entry !== option));
      return;
    }
    onChange([...selected, option]);
  }

  return (
    <div className="sa-multiselect" ref={rootRef}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className="form-control sa-multiselect-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={selected.length === 0 ? "sa-multiselect-placeholder" : "sa-multiselect-value"}>
          {summary}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="sa-multiselect-menu" role="listbox" id={menuId} aria-label={label} aria-multiselectable="true">
          <div className="sa-multiselect-actions">
            <button type="button" className="btn btn-sm btn-light" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          <div className="sa-multiselect-options">
            {options.map((option) => {
              const checked = selected.includes(option);
              return (
                <label key={option} className={`sa-multiselect-option ${checked ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(option)}
                  />
                  <span>{humanizeKey(option)}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statusBadgeClass(active: boolean): string {
  return active ? "badge text-bg-success" : "badge text-bg-secondary";
}

function candidateStatusBadgeClass(status: PlannerPolicyCandidateReviewStatus): string {
  if (status === "approved") return "badge text-bg-success";
  if (status === "rejected") return "badge text-bg-danger";
  return "badge text-bg-warning";
}

function RuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: RuleFormState;
  onChange: (next: RuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof RuleFormState>(key: K, nextValue: RuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-all`}
          label="All Signals"
          value={value.whenSignalsAll}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAll", next)}
          placeholder="Select required signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-any`}
          label="Any Signals"
          value={value.whenSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAny", next)}
          placeholder="Select optional signals"
        />
      </div>
      <div className="col-12">
        <MultiSelectField
          id={`${prefix}-signals-exclude`}
          label="Exclude Signals"
          value={value.excludeSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("excludeSignalsAny", next)}
          placeholder="Select excluded signals"
        />
      </div>
      <div className="col-md-4">
        <MultiSelectField
          id={`${prefix}-prefer-capabilities`}
          label="Prefer Capabilities"
          value={value.preferCapabilities}
          options={CAPABILITY_OPTIONS}
          onChange={(next) => update("preferCapabilities", next)}
          placeholder="Select preferred capabilities"
        />
      </div>
      <div className="col-md-4">
        <MultiSelectField
          id={`${prefix}-penalize-missing`}
          label="Penalize Missing"
          value={value.penalizeMissing}
          options={CAPABILITY_OPTIONS}
          onChange={(next) => update("penalizeMissing", next)}
          placeholder="Select missing-capability penalties"
        />
      </div>
      <div className="col-md-4">
        <MultiSelectField
          id={`${prefix}-require-for-bonus`}
          label="Require For Bonus"
          value={value.requireForBonus}
          options={CAPABILITY_OPTIONS}
          onChange={(next) => update("requireForBonus", next)}
          placeholder="Select bonus prerequisites"
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-boost`}>Boost</label>
        <input
          id={`${prefix}-boost`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.boost}
          onChange={(event) => update("boost", event.target.value)}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-penalty`}>Penalty</label>
        <input
          id={`${prefix}-penalty`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.penalty}
          onChange={(event) => update("penalty", event.target.value)}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-max-effect`}>Max Effect</label>
        <input
          id={`${prefix}-max-effect`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.maxEffect}
          onChange={(event) => update("maxEffect", event.target.value)}
        />
      </div>
      <div className="col-12">
        <div className="small text-muted">Known signals: {SIGNAL_OPTIONS.join(", ")}</div>
        <div className="small text-muted">Known capabilities: {CAPABILITY_OPTIONS.join(", ")}</div>
      </div>
    </div>
  );
}

function PlannerPolicyDrawer({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onClose} />
      <aside className="sa-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sa-drawer-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-sm btn-light" aria-label="Close planner policy drawer" onClick={onClose}>
            <i className="fa fa-times" />
          </button>
        </div>
        <div className="sa-drawer-body">{children}</div>
        <div className="sa-drawer-footer">{footer}</div>
      </aside>
    </>
  );
}

export default function PlannerPoliciesPage() {
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
  const candidatesQuery = usePlannerRerankPolicyCandidates(candidateFilter, verticalNorm);

  const upsertCapability = useUpsertPlannerDomainCapability();
  const deleteCapability = useDeletePlannerDomainCapability();
  const upsertPolicy = useUpsertPlannerRerankPolicy();
  const deletePolicy = useDeletePlannerRerankPolicy();
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
    saveCandidate.isPending ||
    suggestCandidate.isPending ||
    approveCandidate.isPending;
  const deleteBusy =
    deleteCapability.isPending ||
    deletePolicy.isPending ||
    deleteCandidate.isPending;

  function closeDrawer() {
    setDrawerState(null);
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
      scope_vertical_norm: capabilityForm.scopeType.includes("vertical")
        ? verticalNorm.trim() || null
        : null,
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
      scope_vertical_norm: policyForm.scopeType.includes("vertical")
        ? verticalNorm.trim() || null
        : null,
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

  async function handleDeleteCapability(row: PlannerDomainCapabilityRow) {
    if (!row.id) return;
    setDeleteDialog({ kind: "capability", id: row.id, label: row.capability_key });
  }

  async function handleDeletePolicy(row: PlannerRerankPolicyRow) {
    if (!row.id) return;
    setDeleteDialog({ kind: "policy", id: row.id, label: row.name });
  }

  async function handleDeleteCandidate(row: PlannerRerankPolicyCandidateRow) {
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
            : "Unable to delete candidate.";
      toast.error(error instanceof Error ? error.message : fallback);
    }
  }

  const activeCount =
    activeTab === "capabilities"
      ? capabilitiesQuery.data?.capabilities.length ?? 0
      : activeTab === "policies"
        ? policiesQuery.data?.policies.length ?? 0
        : candidatesQuery.data?.candidates.length ?? 0;

  const drawerTitle =
    drawerState?.kind === "capabilities"
      ? drawerState.mode === "create"
        ? "Add Capability"
        : "Edit Capability"
      : drawerState?.kind === "policies"
        ? drawerState.mode === "create"
          ? "Add Policy"
          : "Edit Policy"
        : drawerState?.kind === "candidates"
          ? drawerState.mode === "create"
            ? "Add Candidate"
            : "Edit Candidate"
          : drawerState?.kind === "candidate_suggest"
            ? "Suggest Candidate With AI"
          : "";

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1>Planner Policies</h1>
          <p className="sa-page-subtitle">
            Tune planner-domain reranking with semantic capabilities, scoped policies, and candidate review.
          </p>
        </div>
      </header>

      <section className="sa-card mb-3">
        <div className="row g-3 align-items-end">
          <div className="col-lg-4">
            <label className="form-label" htmlFor="planner-policies-domain">Domain</label>
            <select
              id="planner-policies-domain"
              className="form-select"
              value={selectedDomainId ?? ""}
              onChange={(event) => setSelectedDomainId(Number(event.target.value) || null)}
            >
              <option value="">Select a domain</option>
              {domains.map((domain: Domain) => (
                <option value={domain.id} key={domain.id}>
                  {domain.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-3">
            <label className="form-label" htmlFor="planner-policies-vertical">Vertical Norm</label>
            <input
              id="planner-policies-vertical"
              className="form-control"
              value={verticalNorm}
              onChange={(event) => setVerticalNorm(event.target.value)}
              placeholder="education"
            />
          </div>
          <div className="col-lg-3">
            <label className="form-label" htmlFor="planner-policies-candidate-filter">Candidate Status</label>
            <select
              id="planner-policies-candidate-filter"
              className="form-select"
              value={candidateFilter}
              onChange={(event) => setCandidateFilter(event.target.value as PlannerPolicyCandidateReviewStatus | "")}
            >
              {CANDIDATE_REVIEW_FILTERS.map((value) => (
                <option value={value} key={value || "all"}>
                  {value ? humanizeKey(value) : "All"}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-2">
            <div className="form-check mt-4 pt-2">
              <input
                id="planner-policies-include-inactive"
                className="form-check-input"
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="planner-policies-include-inactive">
                Include inactive
              </label>
            </div>
          </div>
        </div>
        {selectedDomain ? (
          <div className="small text-muted mt-3">
            Selected domain: <strong>{selectedDomain.name}</strong>
          </div>
        ) : null}
      </section>

      <section className="sa-card mb-3">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <ul className="nav nav-tabs" role="tablist" aria-label="Planner policy tabs">
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              const count =
                tab.key === "capabilities"
                  ? capabilitiesQuery.data?.capabilities.length ?? 0
                  : tab.key === "policies"
                    ? policiesQuery.data?.policies.length ?? 0
                    : candidatesQuery.data?.candidates.length ?? 0;
              return (
                <li className="nav-item" role="presentation" key={tab.key}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`nav-link ${active ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label} ({count})
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreateCapability}>
              Add New Capability
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreatePolicy}>
              Add New Policy
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={openCreateCandidate}>
              Add New Candidate
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openSuggestCandidate}>
              Suggest With AI
            </button>
          </div>
        </div>

        <div className="small text-muted mb-3">
          {activeCount} {activeTab.slice(0, -1)}{activeCount === 1 ? "" : "s"} shown
        </div>

        {activeTab === "capabilities" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Scope</th>
                  <th>Support</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {capabilitiesQuery.isLoading ? (
                  <tr><td colSpan={7} className="text-muted">Loading capabilities...</td></tr>
                ) : (capabilitiesQuery.data?.capabilities.length ?? 0) === 0 ? (
                  <tr><td colSpan={7} className="text-muted">No capabilities configured for this scope.</td></tr>
                ) : (
                  capabilitiesQuery.data?.capabilities.map((row) => (
                    <tr key={`${row.id ?? row.capability_key}-${row.source_ref ?? "row"}`} className="sa-row-clickable" onClick={() => openEditCapability(row)}>
                      <td>
                        <div className="fw-semibold">{row.capability_key}</div>
                        {row.notes ? <div className="small text-muted">{row.notes}</div> : null}
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.support_level}</td>
                      <td>
                        {row.source_type}
                        {row.source_ref ? <div className="small text-muted">{row.source_ref}</div> : null}
                      </td>
                      <td>{row.confidence.toFixed(2)}</td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_inherited ? <div className="small text-muted">Inherited</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete capability ${row.capability_key}`} onClick={() => void handleDeleteCapability(row)}>
                            <i className="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "policies" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Priority</th>
                  <th>Rule Summary</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policiesQuery.isLoading ? (
                  <tr><td colSpan={6} className="text-muted">Loading policies...</td></tr>
                ) : (policiesQuery.data?.policies.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No rerank policies configured for this scope.</td></tr>
                ) : (
                  policiesQuery.data?.policies.map((row) => (
                    <tr key={row.id ?? row.policy_key} className="sa-row-clickable" onClick={() => openEditPolicy(row)}>
                      <td>
                        <div className="fw-semibold">{row.name}</div>
                        <div className="small text-muted">{row.policy_key}</div>
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.priority}</td>
                      <td>
                        <div className="small">
                          Signals: {row.policy_json.when_signals_all.concat(row.policy_json.when_signals_any).join(", ") || "None"}
                        </div>
                        <div className="small text-muted">
                          Prefer: {row.policy_json.prefer_capabilities.join(", ") || "None"}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_inherited ? <div className="small text-muted">Inherited</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete policy ${row.name}`} onClick={() => void handleDeletePolicy(row)}>
                            <i className="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "candidates" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidatesQuery.isLoading ? (
                  <tr><td colSpan={5} className="text-muted">Loading candidates...</td></tr>
                ) : (candidatesQuery.data?.candidates.length ?? 0) === 0 ? (
                  <tr><td colSpan={5} className="text-muted">No planner rerank policy candidates found.</td></tr>
                ) : (
                  candidatesQuery.data?.candidates.map((row) => (
                    <tr key={row.id} className="sa-row-clickable" onClick={() => openEditCandidate(row)}>
                      <td>
                        <div className="fw-semibold">{row.candidate_key}</div>
                        <div className="small text-muted">
                          Signals: {row.candidate_json.when_signals_all.concat(row.candidate_json.when_signals_any).join(", ") || "None"}
                        </div>
                      </td>
                      <td>{row.source_type}</td>
                      <td>{row.confidence == null ? "—" : row.confidence.toFixed(2)}</td>
                      <td>
                        <span className={candidateStatusBadgeClass(row.review_status)}>
                          {humanizeKey(row.review_status)}
                        </span>
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          {row.review_status === "pending" ? (
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void handleApproveCandidate(row)}>
                              Approve
                            </button>
                          ) : null}
                          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete candidate ${row.candidate_key}`} onClick={() => void handleDeleteCandidate(row)}>
                            <i className="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {drawerState ? (
        <PlannerPolicyDrawer
          title={drawerTitle}
          onClose={closeDrawer}
          footer={
            <>
              <button type="button" className="btn btn-sm btn-light" onClick={closeDrawer}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                form={
                  drawerState.kind === "candidate_suggest"
                    ? "planner-policies-candidate-suggest-form"
                    : `planner-policies-${drawerState.kind}-form`
                }
                disabled={
                  drawerBusy ||
                  ((drawerState.kind === "candidate_suggest" || drawerState.kind !== "candidates") && !selectedDomainId)
                }
              >
                {drawerBusy
                  ? drawerState.kind === "candidate_suggest"
                    ? "Generating..."
                    : "Saving..."
                  : drawerState.kind === "candidate_suggest"
                    ? "Generate"
                    : drawerState.mode === "create"
                      ? "Create"
                      : "Save"}
              </button>
            </>
          }
        >
          {drawerState.kind === "capabilities" ? (
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
          ) : null}

          {drawerState.kind === "policies" ? (
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
          ) : null}

          {drawerState.kind === "candidates" ? (
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
          ) : null}

          {drawerState.kind === "candidate_suggest" ? (
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
                      {domains
                        .filter((domain: Domain) => domain.id !== selectedDomainId)
                        .map((domain: Domain) => (
                        <option value={domain.id} key={`suggest-domain-${domain.id}`}>
                          {domain.name}
                        </option>
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
                      Target domain: <strong>{selectedDomain?.name ?? "Select a domain first"}</strong>
                    </div>
                    <div className="small text-muted">
                      Vertical norm: <strong>{verticalNorm.trim() || "generic"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          ) : null}
        </PlannerPolicyDrawer>
      ) : null}

      {deleteDialog ? (
        <div className="sa-dialog-backdrop" onClick={deleteBusy ? undefined : () => setDeleteDialog(null)}>
          <div
            className="sa-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Delete ${deleteDialog.kind}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sa-dialog-header">
              <span>
                Delete{" "}
                {deleteDialog.kind === "capability"
                  ? "Capability"
                  : deleteDialog.kind === "policy"
                    ? "Policy"
                    : "Candidate"}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-light"
                aria-label="Close delete dialog"
                onClick={() => setDeleteDialog(null)}
                disabled={deleteBusy}
              >
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="sa-dialog-body">
              Delete{" "}
              <strong>{deleteDialog.label}</strong>
              ? This action cannot be undone.
            </div>
            <div className="sa-dialog-footer">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setDeleteDialog(null)}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => void handleConfirmDelete()}
                disabled={deleteBusy}
              >
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
