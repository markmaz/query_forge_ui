import type {
  PlannerDomainSelectionPolicyRow,
  PlannerDomainCapabilityRow,
  PlannerPromptIntentPolicyRow,
  PlannerProjectionPolicyRow,
  PlannerRetrievalPolicyRow,
  PlannerRerankPolicyCandidateRow,
  PlannerRerankPolicyRow,
  PlannerSignalPolicyRow,
} from "@/features/system-admin/types";

import { candidateStatusBadgeClass, humanizeKey, statusBadgeClass } from "../forms";
import type { PlannerPoliciesTab } from "../types";

type PlannerPoliciesTabContentProps = {
  activeTab: PlannerPoliciesTab;
  capabilities: PlannerDomainCapabilityRow[];
  capabilitiesLoading: boolean;
  policies: PlannerRerankPolicyRow[];
  policiesLoading: boolean;
  projectionPolicies: PlannerProjectionPolicyRow[];
  projectionPoliciesLoading: boolean;
  signalPolicies: PlannerSignalPolicyRow[];
  signalPoliciesLoading: boolean;
  promptIntentPolicies: PlannerPromptIntentPolicyRow[];
  promptIntentPoliciesLoading: boolean;
  retrievalPolicies: PlannerRetrievalPolicyRow[];
  retrievalPoliciesLoading: boolean;
  domainSelectionPolicies: PlannerDomainSelectionPolicyRow[];
  domainSelectionPoliciesLoading: boolean;
  candidates: PlannerRerankPolicyCandidateRow[];
  candidatesLoading: boolean;
  onEditCapability: (row: PlannerDomainCapabilityRow) => void;
  onDeleteCapability: (row: PlannerDomainCapabilityRow) => void | Promise<void>;
  onEditPolicy: (row: PlannerRerankPolicyRow) => void;
  onDeletePolicy: (row: PlannerRerankPolicyRow) => void | Promise<void>;
  onEditProjectionPolicy: (row: PlannerProjectionPolicyRow) => void;
  onDeleteProjectionPolicy: (row: PlannerProjectionPolicyRow) => void | Promise<void>;
  onEditSignalPolicy: (row: PlannerSignalPolicyRow) => void;
  onDeleteSignalPolicy: (row: PlannerSignalPolicyRow) => void | Promise<void>;
  onEditPromptIntentPolicy: (row: PlannerPromptIntentPolicyRow) => void;
  onDeletePromptIntentPolicy: (row: PlannerPromptIntentPolicyRow) => void | Promise<void>;
  onEditRetrievalPolicy: (row: PlannerRetrievalPolicyRow) => void;
  onDeleteRetrievalPolicy: (row: PlannerRetrievalPolicyRow) => void | Promise<void>;
  onEditDomainSelectionPolicy: (row: PlannerDomainSelectionPolicyRow) => void;
  onDeleteDomainSelectionPolicy: (row: PlannerDomainSelectionPolicyRow) => void | Promise<void>;
  onEditCandidate: (row: PlannerRerankPolicyCandidateRow) => void;
  onApproveCandidate: (row: PlannerRerankPolicyCandidateRow) => void | Promise<void>;
  onDeleteCandidate: (row: PlannerRerankPolicyCandidateRow) => void | Promise<void>;
};

export function PlannerPoliciesTabContent({
  activeTab,
  capabilities,
  capabilitiesLoading,
  policies,
  policiesLoading,
  projectionPolicies,
  projectionPoliciesLoading,
  signalPolicies,
  signalPoliciesLoading,
  promptIntentPolicies,
  promptIntentPoliciesLoading,
  retrievalPolicies,
  retrievalPoliciesLoading,
  domainSelectionPolicies,
  domainSelectionPoliciesLoading,
  candidates,
  candidatesLoading,
  onEditCapability,
  onDeleteCapability,
  onEditPolicy,
  onDeletePolicy,
  onEditProjectionPolicy,
  onDeleteProjectionPolicy,
  onEditSignalPolicy,
  onDeleteSignalPolicy,
  onEditPromptIntentPolicy,
  onDeletePromptIntentPolicy,
  onEditRetrievalPolicy,
  onDeleteRetrievalPolicy,
  onEditDomainSelectionPolicy,
  onDeleteDomainSelectionPolicy,
  onEditCandidate,
  onApproveCandidate,
  onDeleteCandidate,
}: PlannerPoliciesTabContentProps) {
  if (activeTab === "capabilities") {
    return (
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
            {capabilitiesLoading ? (
              <tr><td colSpan={7} className="text-muted">Loading capabilities...</td></tr>
            ) : capabilities.length === 0 ? (
              <tr><td colSpan={7} className="text-muted">No capabilities configured for this scope.</td></tr>
            ) : (
              capabilities.map((row) => (
                <tr key={`${row.id ?? row.capability_key}-${row.source_ref ?? "row"}`} className="sa-row-clickable" onClick={() => onEditCapability(row)}>
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
                      <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete capability ${row.capability_key}`} onClick={() => void onDeleteCapability(row)}>
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
    );
  }

  if (activeTab === "policies") {
    return (
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
            {policiesLoading ? (
              <tr><td colSpan={6} className="text-muted">Loading policies...</td></tr>
            ) : policies.length === 0 ? (
              <tr><td colSpan={6} className="text-muted">No rerank policies configured for this scope.</td></tr>
            ) : (
              policies.map((row) => (
                <tr key={row.id ?? row.policy_key} className="sa-row-clickable" onClick={() => onEditPolicy(row)}>
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
                      <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete policy ${row.name}`} onClick={() => void onDeletePolicy(row)}>
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
    );
  }

  if (activeTab === "projection") {
    return (
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
            {projectionPoliciesLoading ? (
              <tr><td colSpan={6} className="text-muted">Loading projection policies...</td></tr>
            ) : projectionPolicies.length === 0 ? (
              <tr><td colSpan={6} className="text-muted">No projection policies configured for this scope.</td></tr>
            ) : (
              projectionPolicies.map((row) => (
                <tr
                  key={`${row.id ?? 0}-${row.policy_key}`}
                  className={row.can_edit === false ? "" : "sa-row-clickable"}
                  onClick={() => onEditProjectionPolicy(row)}
                >
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
                      Require: {row.policy_json.required_concept_keys.join(", ") || row.policy_json.required_column_names.join(", ") || "None"}
                    </div>
                  </td>
                  <td>
                    <span className={statusBadgeClass(row.is_active)}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                    {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                    {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                  </td>
                  <td className="text-end" onClick={(event) => event.stopPropagation()}>
                    <div className="sa-row-actions">
                      {row.can_edit === false ? (
                        <span className="small text-muted">Read only</span>
                      ) : null}
                      {row.can_delete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Delete projection policy ${row.name}`}
                          onClick={() => void onDeleteProjectionPolicy(row)}
                        >
                          <i className="fa fa-trash" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeTab === "signal") {
    return (
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
            {signalPoliciesLoading ? (
              <tr><td colSpan={6} className="text-muted">Loading signal policies...</td></tr>
            ) : signalPolicies.length === 0 ? (
              <tr><td colSpan={6} className="text-muted">No signal policies configured for this scope.</td></tr>
            ) : (
              signalPolicies.map((row) => (
                <tr
                  key={`${row.id ?? 0}-${row.policy_key}`}
                  className={row.can_edit === false ? "" : "sa-row-clickable"}
                  onClick={() => onEditSignalPolicy(row)}
                >
                  <td>
                    <div className="fw-semibold">{row.name}</div>
                    <div className="small text-muted">{row.policy_key}</div>
                  </td>
                  <td>{row.scope_type}</td>
                  <td>{row.priority}</td>
                  <td>
                    <div className="small">Signals: {row.policy_json.signal_keys.join(", ") || "None"}</div>
                    <div className="small text-muted">
                      Match: {row.policy_json.match_type}
                      {row.policy_json.helper_name ? ` · ${row.policy_json.helper_name}` : ""}
                    </div>
                  </td>
                  <td>
                    <span className={statusBadgeClass(row.is_active)}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                    {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                    {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                  </td>
                  <td className="text-end" onClick={(event) => event.stopPropagation()}>
                    <div className="sa-row-actions">
                      {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                      {row.can_delete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Delete signal policy ${row.name}`}
                          onClick={() => void onDeleteSignalPolicy(row)}
                        >
                          <i className="fa fa-trash" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeTab === "prompt_intent") {
    return (
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
            {promptIntentPoliciesLoading ? (
              <tr><td colSpan={6} className="text-muted">Loading prompt intent policies...</td></tr>
            ) : promptIntentPolicies.length === 0 ? (
              <tr><td colSpan={6} className="text-muted">No prompt intent policies configured for this scope.</td></tr>
            ) : (
              promptIntentPolicies.map((row) => (
                <tr
                  key={`${row.id ?? 0}-${row.policy_key}`}
                  className={row.can_edit === false ? "" : "sa-row-clickable"}
                  onClick={() => onEditPromptIntentPolicy(row)}
                >
                  <td>
                    <div className="fw-semibold">{row.name}</div>
                    <div className="small text-muted">{row.policy_key}</div>
                  </td>
                  <td>{row.scope_type}</td>
                  <td>{row.priority}</td>
                  <td>
                    <div className="small">Action: {row.policy_json.action_key}</div>
                    <div className="small text-muted">
                      Regex: {row.policy_json.regex_patterns.length} · Substrings: {row.policy_json.substring_patterns.length}
                    </div>
                  </td>
                  <td>
                    <span className={statusBadgeClass(row.is_active)}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                    {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                    {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                  </td>
                  <td className="text-end" onClick={(event) => event.stopPropagation()}>
                    <div className="sa-row-actions">
                      {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                      {row.can_delete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Delete prompt intent policy ${row.name}`}
                          onClick={() => void onDeletePromptIntentPolicy(row)}
                        >
                          <i className="fa fa-trash" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeTab === "retrieval") {
    return (
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
            {retrievalPoliciesLoading ? (
              <tr><td colSpan={6} className="text-muted">Loading retrieval policies...</td></tr>
            ) : retrievalPolicies.length === 0 ? (
              <tr><td colSpan={6} className="text-muted">No retrieval policies configured for this scope.</td></tr>
            ) : (
              retrievalPolicies.map((row) => (
                <tr
                  key={`${row.id ?? 0}-${row.policy_key}`}
                  className={row.can_edit === false ? "" : "sa-row-clickable"}
                  onClick={() => onEditRetrievalPolicy(row)}
                >
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
                      Queries: {row.policy_json.query_specs.length} · Prefer tokens: {row.policy_json.domain_name_prefer_tokens.length}
                    </div>
                  </td>
                  <td>
                    <span className={statusBadgeClass(row.is_active)}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                    {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                    {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                  </td>
                  <td className="text-end" onClick={(event) => event.stopPropagation()}>
                    <div className="sa-row-actions">
                      {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                      {row.can_delete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Delete retrieval policy ${row.name}`}
                          onClick={() => void onDeleteRetrievalPolicy(row)}
                        >
                          <i className="fa fa-trash" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeTab === "domain_selection") {
    return (
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
            {domainSelectionPoliciesLoading ? (
              <tr><td colSpan={6} className="text-muted">Loading domain selection policies...</td></tr>
            ) : domainSelectionPolicies.length === 0 ? (
              <tr><td colSpan={6} className="text-muted">No domain selection policies configured for this scope.</td></tr>
            ) : (
              domainSelectionPolicies.map((row) => (
                <tr
                  key={`${row.id ?? 0}-${row.policy_key}`}
                  className={row.can_edit === false ? "" : "sa-row-clickable"}
                  onClick={() => onEditDomainSelectionPolicy(row)}
                >
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
                      Features: {row.policy_json.required_shortlist_features.concat(row.policy_json.required_capability_features).join(", ") || "None"}
                    </div>
                  </td>
                  <td>
                    <span className={statusBadgeClass(row.is_active)}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                    {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                    {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                  </td>
                  <td className="text-end" onClick={(event) => event.stopPropagation()}>
                    <div className="sa-row-actions">
                      {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                      {row.can_delete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Delete domain selection policy ${row.name}`}
                          onClick={() => void onDeleteDomainSelectionPolicy(row)}
                        >
                          <i className="fa fa-trash" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
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
          {candidatesLoading ? (
            <tr><td colSpan={5} className="text-muted">Loading candidates...</td></tr>
          ) : candidates.length === 0 ? (
            <tr><td colSpan={5} className="text-muted">No planner rerank policy candidates found.</td></tr>
          ) : (
            candidates.map((row) => (
              <tr key={row.id} className="sa-row-clickable" onClick={() => onEditCandidate(row)}>
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
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void onApproveCandidate(row)}>
                        Approve
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete candidate ${row.candidate_key}`} onClick={() => void onDeleteCandidate(row)}>
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
  );
}
