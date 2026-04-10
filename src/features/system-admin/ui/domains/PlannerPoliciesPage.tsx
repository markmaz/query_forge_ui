import { CANDIDATE_REVIEW_FILTERS, TABS, TAB_COUNT_LABEL } from "./plannerPolicies/constants";
import { humanizeKey } from "./plannerPolicies/forms";
import { PlannerPolicyDrawer } from "./plannerPolicies/components/PlannerPolicyDrawer";
import { PlannerPoliciesDeleteDialog } from "./plannerPolicies/components/PlannerPoliciesDeleteDialog";
import { PlannerPoliciesDrawerForms } from "./plannerPolicies/components/PlannerPoliciesDrawerForms";
import { PlannerPoliciesTabContent } from "./plannerPolicies/components/PlannerPoliciesTabContent";
import { usePlannerPoliciesPageState } from "./plannerPolicies/usePlannerPoliciesPageState";
import "../systemAdmin.css";

export default function PlannerPoliciesPage() {
  const page = usePlannerPoliciesPageState();

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
        <div className="row g-3 align-items-end">
          <div className="col-lg-4">
            <label className="form-label" htmlFor="planner-policies-domain">Domain</label>
            <select
              id="planner-policies-domain"
              className="form-select"
              value={page.selectedDomainId ?? ""}
              onChange={(event) => page.setSelectedDomainId(Number(event.target.value) || null)}
            >
              <option value="">Select a domain</option>
              {page.domains.map((domain) => (
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
              value={page.verticalNorm}
              onChange={(event) => page.setVerticalNorm(event.target.value)}
              placeholder="education"
            />
          </div>
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
          <div className="col-lg-2">
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
        </div>
        {page.selectedDomain ? (
          <div className="small text-muted mt-3">
            Selected domain: <strong>{page.selectedDomain.name}</strong>
          </div>
        ) : null}
      </section>

      <section className="sa-card mb-3">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <ul className="nav nav-tabs" role="tablist" aria-label="Planner policy tabs">
            {TABS.map((tab) => {
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
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openCreateCapability}>
              Add New Capability
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openCreatePolicy}>
              Add New Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openCreateProjectionPolicy}>
              Add New Projection Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openCreateSignalPolicy}>
              Add New Signal Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openCreatePromptIntentPolicy}>
              Add New Prompt Intent Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openCreateRetrievalPolicy}>
              Add New Retrieval Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openCreateDomainSelectionPolicy}>
              Add New Domain Selection Policy
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={page.openCreateCandidate}>
              Add New Candidate
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={page.openSuggestCandidate}>
              Suggest With AI
            </button>
          </div>
        </div>

        <div className="small text-muted mb-3">
          {page.activeCount} {TAB_COUNT_LABEL[page.activeTab]}{page.activeCount === 1 ? "" : "s"} shown
        </div>

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
            verticalNorm={page.verticalNorm}
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
