import { useEffect, useId, useRef, useState } from "react";

import type {
  PlannerProjectionMode,
  PlannerPromptIntentActionKey,
  PlannerSignalHelperName,
  PlannerSignalMatchType,
} from "@/features/system-admin/types";

import {
  CAPABILITY_OPTIONS,
  DOMAIN_SELECTION_FEATURE_OPTIONS,
  PROMPT_INTENT_ACTION_OPTIONS,
  PROJECTION_COLUMN_NAME_OPTIONS,
  PROJECTION_CONCEPT_OPTIONS,
  PROJECTION_JOIN_TABLE_OPTIONS,
  SIGNAL_HELPER_OPTIONS,
  SIGNAL_MATCH_TYPE_OPTIONS,
  SIGNAL_OPTIONS,
} from "../constants";
import { dedupeValues, humanizeKey } from "../forms";
import type {
  DomainSelectionRuleFormState,
  ProjectionRuleFormState,
  PromptIntentRuleFormState,
  RetrievalRuleFormState,
  RuleFormState,
  SignalRuleFormState,
} from "../types";

type MultiSelectFieldProps<T extends string> = {
  id: string;
  label: string;
  value: T[];
  options: readonly T[];
  onChange: (next: T[]) => void;
  placeholder: string;
};

function MultiSelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
}: MultiSelectFieldProps<T>) {
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

type TokenListFieldProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  suggestions?: readonly string[];
  normalize?: (value: string) => string;
  hint?: string;
};

function TokenListField({
  id,
  label,
  value,
  onChange,
  placeholder,
  suggestions = [],
  normalize,
  hint,
}: TokenListFieldProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  function commit(raw: string) {
    const cleaned = (normalize ? normalize(raw) : raw).trim();
    if (!cleaned) return;
    if (value.includes(cleaned)) {
      setDraft("");
      return;
    }
    onChange([...value, cleaned]);
    setDraft("");
  }

  function remove(token: string) {
    onChange(value.filter((entry) => entry !== token));
  }

  return (
    <div className="sa-token-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div
        className="form-control sa-token-field__control"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="sa-token-field__chips">
          {value.map((token) => (
            <span key={token} className="sa-token-field__chip">
              <span>{token}</span>
              <button type="button" aria-label={`Remove ${token}`} onClick={() => remove(token)}>
                <i className="fa fa-times" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            className="sa-token-field__input"
            value={draft}
            list={suggestions.length > 0 ? listId : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commit(draft);
              } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
                remove(value[value.length - 1] ?? "");
              }
            }}
            onBlur={() => commit(draft)}
            placeholder={value.length === 0 ? placeholder : ""}
          />
        </div>
      </div>
      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
      {hint ? <div className="small text-muted">{hint}</div> : null}
    </div>
  );
}

export function RuleEditorFields({
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

export function ProjectionRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: ProjectionRuleFormState;
  onChange: (next: ProjectionRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof ProjectionRuleFormState>(key: K, nextValue: ProjectionRuleFormState[K]) {
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
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-exclude`}
          label="Exclude Signals"
          value={value.excludeSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("excludeSignalsAny", next)}
          placeholder="Select excluded signals"
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-projection-mode`}>Projection Mode</label>
        <select
          id={`${prefix}-projection-mode`}
          className="form-select"
          value={value.projectionMode}
          onChange={(event) => update("projectionMode", event.target.value as PlannerProjectionMode)}
        >
          <option value="prepend">Prepend</option>
          <option value="append">Append</option>
        </select>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-concepts`}
          label="Required Concepts"
          value={value.requiredConceptKeys}
          onChange={(next) => update("requiredConceptKeys", next)}
          placeholder="STUDENT_ID, STUDENT_FIRST_NAME"
          suggestions={PROJECTION_CONCEPT_OPTIONS}
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-excluded-concepts`}
          label="Excluded Concepts"
          value={value.excludedConceptKeys}
          onChange={(next) => update("excludedConceptKeys", next)}
          placeholder="SCHOOL_ID"
          suggestions={PROJECTION_CONCEPT_OPTIONS}
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-columns`}
          label="Required Columns"
          value={value.requiredColumnNames}
          onChange={(next) => update("requiredColumnNames", next)}
          placeholder="school_name, lea_name"
          suggestions={PROJECTION_COLUMN_NAME_OPTIONS}
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-excluded-columns`}
          label="Excluded Columns"
          value={value.excludedColumnNames}
          onChange={(next) => update("excludedColumnNames", next)}
          placeholder="staff_classification"
          suggestions={PROJECTION_COLUMN_NAME_OPTIONS}
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-filter-concepts`}
          label="Required Filter Concepts"
          value={value.requiredFilterConceptKeys}
          onChange={(next) => update("requiredFilterConceptKeys", next)}
          placeholder="SCHOOL_NAME"
          suggestions={PROJECTION_CONCEPT_OPTIONS}
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-joins`}
          label="Required Join Tables"
          value={value.requiredJoinTables}
          onChange={(next) => update("requiredJoinTables", next)}
          placeholder="dim_school"
          suggestions={PROJECTION_JOIN_TABLE_OPTIONS}
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-12">
        <div className="small text-muted">Use Enter or comma to add chips. Known concepts and join tables are suggested, but you can still add custom values.</div>
      </div>
    </div>
  );
}

export function SignalRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: SignalRuleFormState;
  onChange: (next: SignalRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof SignalRuleFormState>(key: K, nextValue: SignalRuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signal-keys`}
          label="Signal Keys"
          value={value.signalKeys}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("signalKeys", next)}
          placeholder="Select emitted signals"
        />
      </div>
      <div className="col-md-3">
        <label className="form-label" htmlFor={`${prefix}-match-type`}>Match Type</label>
        <select
          id={`${prefix}-match-type`}
          className="form-select"
          value={value.matchType}
          onChange={(event) => update("matchType", event.target.value as PlannerSignalMatchType)}
        >
          {SIGNAL_MATCH_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="col-md-3 d-flex align-items-end">
        <div className="form-check mb-2">
          <input
            id={`${prefix}-case-sensitive`}
            className="form-check-input"
            type="checkbox"
            checked={value.caseSensitive}
            onChange={(event) => update("caseSensitive", event.target.checked)}
          />
          <label className="form-check-label" htmlFor={`${prefix}-case-sensitive`}>Case Sensitive</label>
        </div>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-patterns`}
          label="Patterns"
          value={value.patterns}
          onChange={(next) => update("patterns", next)}
          placeholder="Regex or substring patterns"
          hint="Used for regex, regex_all, and substring_any match types."
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-helper-name`}>Helper Name</label>
        <select
          id={`${prefix}-helper-name`}
          className="form-select"
          value={value.helperName}
          onChange={(event) => update("helperName", event.target.value as PlannerSignalHelperName | "")}
        >
          <option value="">None</option>
          {SIGNAL_HELPER_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-suffixes`}
          label="Suffixes"
          value={value.suffixes}
          onChange={(next) => update("suffixes", next)}
          placeholder="elementary, middle, high"
          normalize={(entry) => entry.toLowerCase()}
          hint="Used for school_literal rules."
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-stopwords`}
          label="Stopwords"
          value={value.stopwords}
          onChange={(next) => update("stopwords", next)}
          placeholder="the, show, list"
          normalize={(entry) => entry.toLowerCase()}
          hint="Used for school_literal rules."
        />
      </div>
    </div>
  );
}

export function PromptIntentRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: PromptIntentRuleFormState;
  onChange: (next: PromptIntentRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof PromptIntentRuleFormState>(key: K, nextValue: PromptIntentRuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-action-key`}>Action Key</label>
        <select
          id={`${prefix}-action-key`}
          className="form-select"
          value={value.actionKey}
          onChange={(event) => update("actionKey", event.target.value as PlannerPromptIntentActionKey)}
        >
          {PROMPT_INTENT_ACTION_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-state-codes`}
          label="State Codes"
          value={value.stateCodes}
          onChange={(next) => update("stateCodes", next)}
          placeholder="tn, tx"
          normalize={(entry) => entry.toLowerCase()}
          hint="Used for city_state_abbr rules."
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-regex-patterns`}
          label="Regex Patterns"
          value={value.regexPatterns}
          onChange={(next) => update("regexPatterns", next)}
          placeholder="Regex patterns"
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-substring-patterns`}
          label="Substring Patterns"
          value={value.substringPatterns}
          onChange={(next) => update("substringPatterns", next)}
          placeholder="Plain-text substrings"
        />
      </div>
    </div>
  );
}

export function RetrievalRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: RetrievalRuleFormState;
  onChange: (next: RetrievalRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof RetrievalRuleFormState>(key: K, nextValue: RetrievalRuleFormState[K]) {
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
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-exclude`}
          label="Exclude Signals"
          value={value.excludeSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("excludeSignalsAny", next)}
          placeholder="Select excluded signals"
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-concept-patterns`}
          label="Concept Key Patterns"
          value={value.whenConceptKeyPatternsAny}
          onChange={(next) => update("whenConceptKeyPatternsAny", next)}
          placeholder="SCHOOL_YEAR, TERM"
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-prefer-tokens`}
          label="Prefer Name Tokens"
          value={value.domainNamePreferTokens}
          onChange={(next) => update("domainNamePreferTokens", next)}
          placeholder="provider, territory"
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-avoid-tokens`}
          label="Avoid Name Tokens"
          value={value.domainNameAvoidTokens}
          onChange={(next) => update("domainNameAvoidTokens", next)}
          placeholder="student, discipline"
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-positive-bias`}>Positive Bias</label>
        <input
          id={`${prefix}-positive-bias`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.domainNamePositiveBias}
          onChange={(event) => update("domainNamePositiveBias", event.target.value)}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-negative-bias`}>Negative Bias</label>
        <input
          id={`${prefix}-negative-bias`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.domainNameNegativeBias}
          onChange={(event) => update("domainNameNegativeBias", event.target.value)}
        />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`${prefix}-query-specs`}>Query Specs JSON</label>
        <textarea
          id={`${prefix}-query-specs`}
          className="form-control"
          rows={8}
          value={value.querySpecsJson}
          onChange={(event) => update("querySpecsJson", event.target.value)}
        />
        <div className="small text-muted">
          Array of objects like{" "}
          <code>[{"{"}"query":"provider territory","source":"vector","score_boost":0.1,"reasons":["semantic_query:provider"]{"}"}]</code>
        </div>
      </div>
    </div>
  );
}

export function DomainSelectionRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: DomainSelectionRuleFormState;
  onChange: (next: DomainSelectionRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof DomainSelectionRuleFormState>(key: K, nextValue: DomainSelectionRuleFormState[K]) {
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
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-shortlist-features`}
          label="Required Shortlist Features"
          value={value.requiredShortlistFeatures}
          options={DOMAIN_SELECTION_FEATURE_OPTIONS}
          onChange={(next) => update("requiredShortlistFeatures", next)}
          placeholder="Select shortlist features"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-capability-features`}
          label="Required Capability Features"
          value={value.requiredCapabilityFeatures}
          options={DOMAIN_SELECTION_FEATURE_OPTIONS}
          onChange={(next) => update("requiredCapabilityFeatures", next)}
          placeholder="Select capability features"
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-score-delta`}>Score Delta</label>
        <input
          id={`${prefix}-score-delta`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.scoreDelta}
          onChange={(event) => update("scoreDelta", event.target.value)}
        />
      </div>
    </div>
  );
}
