import { useState } from "react";

import type { FlowForgeRunAsPrincipal, FlowForgeWorkflowDefinition, FlowForgeWorkflowVersion } from "../model/types";
import { ownerDisplayName, principalDisplayName } from "../model/workflowIdentity";

interface FlowForgeDesignerRailProps {
  workflowsOpen: boolean;
  aiOpen: boolean;
  onToggleWorkflows: () => void;
  onToggleAi: () => void;
  onCreateBlankWorkflow: () => void;
  onCreateTemplateWorkflow: () => void;
  onSaveVersion: () => void;
  createBlankDisabled: boolean;
  createTemplateDisabled: boolean;
  saveVersionDisabled: boolean;
}

function RailButton({
  active,
  disabled,
  icon,
  label,
  onClick,
  primary,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  const tone = primary || active ? "btn-primary" : "btn-outline-secondary";
  return (
    <button
      type="button"
      className={`btn btn-sm ${tone}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <i className={`fa ${icon}`} aria-hidden="true" />
    </button>
  );
}

export function FlowForgeWorkflowPanel({
  activeWorkflowId,
  activeWorkflowPersisted,
  activeWorkflowVersions = [],
  onCopyWorkflow,
  onDeleteWorkflow,
  onOpenWorkflow,
  onPublishWorkflow,
  onPublishVersion,
  publishVersionPending,
  publishableWorkflowId,
  canPublishWorkflow,
  open,
  principals = [],
  workflows,
}: {
  activeWorkflowId: string;
  activeWorkflowPersisted: boolean;
  activeWorkflowVersions?: FlowForgeWorkflowVersion[];
  onCopyWorkflow: (workflow: FlowForgeWorkflowDefinition) => void;
  onDeleteWorkflow: (workflow: FlowForgeWorkflowDefinition) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onPublishWorkflow: (workflow: FlowForgeWorkflowDefinition) => void;
  onPublishVersion: (versionId: number) => void;
  publishVersionPending: boolean;
  publishableWorkflowId?: string;
  canPublishWorkflow: boolean;
  open: boolean;
  principals?: FlowForgeRunAsPrincipal[];
  workflows: FlowForgeWorkflowDefinition[];
}) {
  return (
    <aside className={`ff-workflow-panel ${open ? "is-open" : "is-closed"}`} aria-hidden={!open}>
      <div className="ff-workflow-panel-shell">
        <div className="ff-eyebrow">Workflow</div>
        <h2>Open Workflow</h2>
        <div className="ff-workflow-card-list">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              active={workflow.id === activeWorkflowId}
              principals={principals}
              workflow={workflow}
              onCopy={() => onCopyWorkflow(workflow)}
              onDelete={() => onDeleteWorkflow(workflow)}
              onOpen={() => onOpenWorkflow(workflow.id)}
              onPublish={() => onPublishWorkflow(workflow)}
              publishEnabled={canPublishWorkflow && workflow.id === publishableWorkflowId}
            />
          ))}
        </div>
        {!workflows.length ? <p className="ff-muted">No saved workflows yet. Use the rail to start from scratch or from a template.</p> : null}
        <p className="ff-muted">Open a saved workflow, copy it, publish a valid version, or archive old drafts.</p>
        <section className="ff-workflow-version-section" aria-label="Workflow version history">
          <div>
            <div className="ff-eyebrow">Version history</div>
            <h2>Drafts and publishes</h2>
          </div>
          {!activeWorkflowPersisted ? (
            <p className="ff-muted">Create a persisted draft before saving versions or publishing.</p>
          ) : activeWorkflowVersions.length ? (
            <div className="ff-version-list">
              {activeWorkflowVersions.map((version) => (
                <article key={version.id} className="ff-version-card">
                  <div>
                    <strong>Version {version.version_number}</strong>
                    <span>{version.version_status}</span>
                  </div>
                  <small>{version.validation_status}</small>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={!canPublishWorkflow || version.version_status === "published" || version.validation_status !== "valid" || publishVersionPending}
                    onClick={() => onPublishVersion(version.id)}
                  >
                    Publish
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="ff-muted">No saved versions yet.</p>
          )}
        </section>
      </div>
    </aside>
  );
}

function WorkflowCard({
  active,
  onCopy,
  onDelete,
  onOpen,
  onPublish,
  publishEnabled,
  principals = [],
  workflow,
}: {
  active: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onPublish: () => void;
  publishEnabled: boolean;
  principals?: FlowForgeRunAsPrincipal[];
  workflow: FlowForgeWorkflowDefinition;
}) {
  const persisted = /^\d+$/.test(workflow.id);
  const lifecycle = workflow.lifecycle || (persisted ? "development" : "starter");
  const runAs = principalDisplayName(workflow.run_as_principal, principals);
  return (
    <article className={`ff-workflow-card ${active ? "is-active" : ""}`}>
      <button type="button" className="ff-workflow-card-main" onClick={onOpen} title={workflow.name}>
        <span className="ff-workflow-card-title">{workflow.name}</span>
        <span className="ff-workflow-card-meta">{workflow.status} · {lifecycle}</span>
        <span className="ff-workflow-card-detail">Owner: {ownerDisplayName(workflow)}</span>
        <span className="ff-workflow-card-detail">{runAs}</span>
      </button>
      <WorkflowCardMenu
        canDelete={persisted}
        canPublish={persisted && publishEnabled}
        onCopy={onCopy}
        onDelete={onDelete}
        onOpen={onOpen}
        onPublish={onPublish}
      />
    </article>
  );
}

function WorkflowCardMenu({
  canDelete,
  canPublish,
  onCopy,
  onDelete,
  onOpen,
  onPublish,
}: {
  canDelete: boolean;
  canPublish: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onPublish: () => void;
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
        title="Workflow options"
        aria-label="Workflow options"
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
            Open
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCopy();
            }}
          >
            Copy
          </button>
          <button
            type="button"
            disabled={!canPublish}
            onClick={() => {
              setOpen(false);
              onPublish();
            }}
          >
            Publish workflow
          </button>
          <div className="ff-workflow-menu-divider" />
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete workflow
          </button>
        </div>
      ) : null}
      {open ? <div className="ff-workflow-menu-backdrop" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}

export default function FlowForgeDesignerRail({
  workflowsOpen,
  aiOpen,
  onToggleWorkflows,
  onToggleAi,
  onCreateBlankWorkflow,
  onCreateTemplateWorkflow,
  onSaveVersion,
  createBlankDisabled,
  createTemplateDisabled,
  saveVersionDisabled,
}: FlowForgeDesignerRailProps) {
  return (
    <aside className="ncqv2-builder-rail" aria-label="Workflow Studio designer tools">
      <div className="ncqv2-rail-top">
        <RailButton
          primary
          icon="fa-save"
          label="Save draft version"
          onClick={onSaveVersion}
          disabled={saveVersionDisabled}
        />
        <RailButton
          active={workflowsOpen}
          icon="fa-folder-open"
          label={workflowsOpen ? "Hide workflows" : "Open workflows"}
          onClick={onToggleWorkflows}
        />
        <RailButton
          icon="fa-plus"
          label="New from scratch"
          onClick={onCreateBlankWorkflow}
          disabled={createBlankDisabled}
        />
        <RailButton
          icon="fa-copy"
          label="New from template"
          onClick={onCreateTemplateWorkflow}
          disabled={createTemplateDisabled}
        />
      </div>
      <div className="ncqv2-rail-divider" />
      <RailButton
        active={aiOpen}
        icon="fa-wand-magic-sparkles"
        label={aiOpen ? "Hide AI" : "Open AI"}
        onClick={onToggleAi}
      />
    </aside>
  );
}
