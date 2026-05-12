import {
  CANDIDATE_REVIEW_FILTERS,
  TAB_COUNT_LABEL,
  TAB_GROUPS,
  TAB_SCOPE_SECTION,
  TABS,
} from "./plannerPolicies/constants";
import { humanizeKey } from "./plannerPolicies/forms";
import { PlannerPolicyDrawer } from "./plannerPolicies/components/PlannerPolicyDrawer";
import { PlannerPoliciesDeleteDialog } from "./plannerPolicies/components/PlannerPoliciesDeleteDialog";
import { PlannerPoliciesDrawerForms } from "./plannerPolicies/components/PlannerPoliciesDrawerForms";
import { PlannerPoliciesTabContent } from "./plannerPolicies/components/PlannerPoliciesTabContent";
import { usePlannerPoliciesPageState } from "./plannerPolicies/usePlannerPoliciesPageState";
import { groupDomainRows, isWorkflowDomain, workflowDomainBadgeLabel } from "@/shared/domain/domainPresentation";
import "../systemAdmin.css";

export default function PlannerPoliciesPage() {
  const page = usePlannerPoliciesPageState();
  const activeScopeSection = TAB_SCOPE_SECTION[page.activeTab];
  const activeScopeGroup = TAB_GROUPS.find((group) => group.key === activeScopeSection);
  const showDomainSelector = activeScopeSection === "domain";
  const showCandidateFilter = page.activeTab === "candidates";
  const showIncludeInactive = page.activeTab !== "candidates";
  const activeTabLabel = TABS.find((tab) => tab.key === page.activeTab)?.label ?? "Policies";
  const groupedDomainOptions = groupDomainRows(page.domainOptions);

  const activeScopeDescription =
    page.activeTab === "candidates"
      ? "This tab uses the selected domain when reviewing candidate policies before promotion."
      : activeScopeSection === "domain"
        ? "This tab uses the selected domain and can also inherit workspace or global fallbacks."
        : "This tab applies across the workspace or globally. Domain-specific selectors are not used here.";

  const actions =
    page.activeTab === "capabilities"
      ? [
          <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreateCapability} key="capability">
            Add New Capability
          </button>,
        ]
      : page.activeTab === "policies"
        ? [
            <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreatePolicy} key="policy">
              Add New Policy
            </button>,
          ]
        : page.activeTab === "projection"
          ? [
              <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreateProjectionPolicy} key="projection">
                Add New Projection Policy
              </button>,
            ]
          : page.activeTab === "signal"
            ? [
                <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreateSignalPolicy} key="signal">
                  Add New Signal Policy
                </button>,
              ]
            : page.activeTab === "prompt_intent"
              ? [
                  <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreatePromptIntentPolicy} key="prompt-intent">
                    Add New Prompt Intent Policy
                  </button>,
                ]
              : page.activeTab === "retrieval"
                ? [
                    <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreateRetrievalPolicy} key="retrieval">
                      Add New Retrieval Policy
                    </button>,
                  ]
                : page.activeTab === "domain_selection"
                  ? [
                      <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreateDomainSelectionPolicy} key="domain-selection">
                        Add New Domain Selection Policy
                      </button>,
                    ]
                  : [
                      <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreateCandidate} key="candidate">
                        Add New Candidate
                      </button>,
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openSuggestCandidate} key="suggest">
                        Suggest With AI
                      </button>,
                    ];

  function handleSelectScopeSection(sectionKey: "domain" | "cross_domain") {
    if (sectionKey === activeScopeSection) return;
    const nextGroup = TAB_GROUPS.find((group) => group.key === sectionKey);
    const nextTab = nextGroup?.tabs[0];
    if (nextTab) {
      page.setActiveTab(nextTab);
    }
  }

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1>Planner Policies</h1>
          <p className="sa-page-subtitle">
            Tune planner-domain reranking and deterministic projection behavior with semantic capabilities, scoped policies, and candidate review.
          </p>
        </div>
      </header>

      <section className="sa-card mb-3">
        <div className="small text-uppercase text-muted mb-1">Scope</div>
        <ul className="nav nav-tabs mb-3" role="tablist" aria-label="Planner policy scope tabs">
          {TAB_GROUPS.map((group) => {
            const active = group.key === activeScopeSection;
            return (
              <li className="nav-item" role="presentation" key={group.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`nav-link ${active ? "active" : ""}`}
                  onClick={() => handleSelectScopeSection(group.key)}
                >
                  {group.label}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <div className="small text-uppercase text-muted">Active Scope</div>
            <div className="fw-semibold">
              {activeScopeGroup?.label ?? "Planner Policies"}: {activeTabLabel}
            </div>
            <div className="small text-muted">{activeScopeDescription}</div>
          </div>
          {showDomainSelector && page.selectedDomain ? (
            <div className="small text-muted">
              Selected domain: <strong>{page.selectedDomain.name}</strong>
            </div>
          ) : null}
        </div>
        <div className="row g-3 align-items-end">
          {showDomainSelector ? (
            <div className="col-lg-4">
              <label className="form-label" htmlFor="planner-policies-domain">Domain</label>
              <select
                id="planner-policies-domain"
                className="form-select"
                value={page.selectedDomainId ?? ""}
                onChange={(event) => page.setSelectedDomainId(Number(event.target.value) || null)}
              >
                <option value="">Select a domain</option>
                {groupedDomainOptions.map((group) => (
                  <optgroup label={group.label} key={`select-${group.key}`}>
                    {group.rows.map((domain) => (
                      <option value={domain.id} key={domain.id}>
                        {isWorkflowDomain(domain) ? `Workflow - ${domain.label}` : domain.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : null}
          {showCandidateFilter ? (
            <div className="col-lg-3">
              <label className="form-label" htmlFor="planner-policies-candidate-filter">Candidate Status</label>
              <select
                id="planner-policies-candidate-filter"
                className="form-select"
                value={page.candidateFilter}
                onChange={(event) => page.setCandidateFilter(event.target.value as typeof page.candidateFilter)}
              >
                {CANDIDATE_REVIEW_FILTERS.map((value) => (
                  <option value={value} key={value || "all"}>
                    {value ? humanizeKey(value) : "All"}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {showIncludeInactive ? (
            <div className="col-lg-3">
              <div className="form-check mt-4 pt-2">
                <input
                  id="planner-policies-include-inactive"
                  className="form-check-input"
                  type="checkbox"
                  checked={page.includeInactive}
                  onChange={(event) => page.setIncludeInactive(event.target.checked)}
                />
                <label className="form-check-label" htmlFor="planner-policies-include-inactive">
                  Include inactive
                </label>
              </div>
            </div>
          ) : null}
          {showDomainSelector ? (
            <div className="col-lg-2">
              <div className="form-check mt-4 pt-2">
                <input
                  id="planner-policies-configured-only"
                  className="form-check-input"
                  type="checkbox"
                  checked={page.configuredOnly}
                  onChange={(event) => page.setConfiguredOnly(event.target.checked)}
                />
                <label className="form-check-label" htmlFor="planner-policies-configured-only">
                  Configured only
                </label>
              </div>
            </div>
          ) : null}
        </div>
        {showDomainSelector ? (
          <div className="mt-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div className="small text-uppercase text-muted">Domain Coverage</div>
              {page.domainCoverageLoading ? <div className="small text-muted">Loading coverage...</div> : null}
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Capabilities</th>
                    <th>Policies</th>
                    <th>Projection Policies</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {page.domainOptions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted">
                        No domains match the current coverage filter.
                      </td>
                    </tr>
                  ) : (
                    groupedDomainOptions.flatMap((group) => [
                      <tr key={`group-${group.key}`} className={`sa-domain-group-row ${group.className}`}>
                        <td colSpan={5}>
                          <span>{group.label}</span>
                          <span className="sa-domain-group-count">{group.rows.length}</span>
                        </td>
                      </tr>,
                      ...group.rows.map((domain) => {
                      const coverage = page.domainCoverageRows.find((row) => row.domainId === domain.id);
                      const selected = domain.id === page.selectedDomainId;
                      const workflowBadge = workflowDomainBadgeLabel(domain);
                      return (
                        <tr
                          key={domain.id}
                          className={`${selected ? "table-primary" : "sa-row-clickable"} ${isWorkflowDomain(domain) ? "sa-domain-row--workflow" : ""}`}
                          onClick={() => page.setSelectedDomainId(domain.id)}
                        >
                          <td>
                            <div className="sa-domain-name-cell">
                              <span className="fw-semibold">{domain.name}</span>
                              {workflowBadge ? <span className="sa-domain-workflow-badge">{workflowBadge}</span> : null}
                            </div>
                            {selected ? <div className="small text-muted">Selected</div> : null}
                          </td>
                          <td>{coverage?.capabilityCount ?? 0}</td>
                          <td>{coverage?.policyCount ?? 0}</td>
                          <td>{coverage?.projectionPolicyCount ?? 0}</td>
                          <td>
                            <span
                              className={
                                coverage?.status === "configured"
                                  ? "badge text-bg-success"
                                  : coverage?.status === "partial"
                                    ? "badge text-bg-warning"
                                    : "badge text-bg-secondary"
                              }
                            >
                              {coverage?.status === "configured"
                                ? "Configured"
                                : coverage?.status === "partial"
                                  ? "Partial"
                                  : "Empty"}
                            </span>
                          </td>
                        </tr>
                      );
                    }),
                    ])
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <hr className="my-4" />
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3 mt-1">
          <div className="d-flex flex-column gap-3 flex-grow-1">
            {activeScopeGroup ? (
              <div>
                <div className="small text-muted mb-2">{activeScopeGroup.description}</div>
                <ul className="nav nav-tabs" role="tablist" aria-label={`${activeScopeGroup.label} policy tabs`}>
                  {activeScopeGroup.tabs.map((tabKey) => {
                    const tab = TABS.find((entry) => entry.key === tabKey);
                    if (!tab) return null;
                    const active = tab.key === page.activeTab;
                    return (
                      <li className="nav-item" role="presentation" key={tab.key}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={`nav-link ${active ? "active" : ""}`}
                          onClick={() => page.setActiveTab(tab.key)}
                        >
                          {tab.label} ({page.tabCounts[tab.key]})
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="d-flex flex-wrap gap-2 align-self-start">
            {actions}
          </div>
        </div>

        <div className="small text-muted mb-3">
          {page.activeCount} {TAB_COUNT_LABEL[page.activeTab]}{page.activeCount === 1 ? "" : "s"} shown
        </div>

        {showDomainSelector && !page.selectedDomainHasExplicitConfig ? (
          <div className="alert alert-info" role="status">
            No domain-scoped capabilities, rerank policies, or projection policies are configured for this domain yet. Start with a capability or add a domain policy override.
          </div>
        ) : null}

        <PlannerPoliciesTabContent
          activeTab={page.activeTab}
          capabilities={page.capabilities}
          capabilitiesLoading={page.capabilitiesLoading}
          policies={page.policies}
          policiesLoading={page.policiesLoading}
          projectionPolicies={page.projectionPolicies}
          projectionPoliciesLoading={page.projectionPoliciesLoading}
          signalPolicies={page.signalPolicies}
          signalPoliciesLoading={page.signalPoliciesLoading}
          promptIntentPolicies={page.promptIntentPolicies}
          promptIntentPoliciesLoading={page.promptIntentPoliciesLoading}
          retrievalPolicies={page.retrievalPolicies}
          retrievalPoliciesLoading={page.retrievalPoliciesLoading}
          domainSelectionPolicies={page.domainSelectionPolicies}
          domainSelectionPoliciesLoading={page.domainSelectionPoliciesLoading}
          candidates={page.candidates}
          candidatesLoading={page.candidatesLoading}
          onEditCapability={page.openEditCapability}
          onDeleteCapability={page.handleDeleteCapability}
          onEditPolicy={page.openEditPolicy}
          onDeletePolicy={page.handleDeletePolicy}
          onEditProjectionPolicy={page.openEditProjectionPolicy}
          onDeleteProjectionPolicy={page.handleDeleteProjectionPolicy}
          onEditSignalPolicy={page.openEditSignalPolicy}
          onDeleteSignalPolicy={page.handleDeleteSignalPolicy}
          onEditPromptIntentPolicy={page.openEditPromptIntentPolicy}
          onDeletePromptIntentPolicy={page.handleDeletePromptIntentPolicy}
          onEditRetrievalPolicy={page.openEditRetrievalPolicy}
          onDeleteRetrievalPolicy={page.handleDeleteRetrievalPolicy}
          onEditDomainSelectionPolicy={page.openEditDomainSelectionPolicy}
          onDeleteDomainSelectionPolicy={page.handleDeleteDomainSelectionPolicy}
          onEditCandidate={page.openEditCandidate}
          onApproveCandidate={page.handleApproveCandidate}
          onDeleteCandidate={page.handleDeleteCandidate}
        />
      </section>

      {page.drawerState ? (
        <PlannerPolicyDrawer
          title={page.drawerTitle}
          onClose={page.closeDrawer}
          footer={
            <>
              <button type="button" className="btn btn-sm btn-light" onClick={page.closeDrawer}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                form={page.drawerFormId}
                disabled={page.drawerSubmitDisabled}
              >
                {page.drawerSubmitLabel}
              </button>
            </>
          }
        >
          <PlannerPoliciesDrawerForms
            drawerState={page.drawerState}
            capabilityForm={page.capabilityForm}
            setCapabilityForm={page.setCapabilityForm}
            policyForm={page.policyForm}
            setPolicyForm={page.setPolicyForm}
            projectionPolicyForm={page.projectionPolicyForm}
            setProjectionPolicyForm={page.setProjectionPolicyForm}
            signalPolicyForm={page.signalPolicyForm}
            setSignalPolicyForm={page.setSignalPolicyForm}
            promptIntentPolicyForm={page.promptIntentPolicyForm}
            setPromptIntentPolicyForm={page.setPromptIntentPolicyForm}
            retrievalPolicyForm={page.retrievalPolicyForm}
            setRetrievalPolicyForm={page.setRetrievalPolicyForm}
            domainSelectionPolicyForm={page.domainSelectionPolicyForm}
            setDomainSelectionPolicyForm={page.setDomainSelectionPolicyForm}
            candidateForm={page.candidateForm}
            setCandidateForm={page.setCandidateForm}
            suggestForm={page.suggestForm}
            setSuggestForm={page.setSuggestForm}
            domains={page.domains}
            selectedDomainId={page.selectedDomainId}
            selectedDomainName={page.selectedDomain?.name ?? null}
            handleSaveCapability={page.handleSaveCapability}
            handleSavePolicy={page.handleSavePolicy}
            handleSaveProjectionPolicy={page.handleSaveProjectionPolicy}
            handleSaveSignalPolicy={page.handleSaveSignalPolicy}
            handleSavePromptIntentPolicy={page.handleSavePromptIntentPolicy}
            handleSaveRetrievalPolicy={page.handleSaveRetrievalPolicy}
            handleSaveDomainSelectionPolicy={page.handleSaveDomainSelectionPolicy}
            handleSaveCandidate={page.handleSaveCandidate}
            handleSuggestCandidate={page.handleSuggestCandidate}
          />
        </PlannerPolicyDrawer>
      ) : null}

      {page.deleteDialog ? (
        <PlannerPoliciesDeleteDialog
          deleteDialog={page.deleteDialog}
          deleteBusy={page.deleteBusy}
          onClose={page.closeDeleteDialog}
          onConfirm={page.handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}
