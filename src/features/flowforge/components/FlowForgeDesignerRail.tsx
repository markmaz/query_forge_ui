import { useState } from "react";

import type { FlowForgeWorkflowDefinition } from "../model/types";

interface FlowForgeDesignerRailProps {
  workflowsOpen: boolean;
  aiOpen: boolean;
  onToggleWorkflows: () => void;
  onToggleAi: () => void;
  onCreateDraft: () => void;
  onCreateBlankWorkflow: () => void;
  onSaveVersion: () => void;
  createDraftDisabled: boolean;
  createBlankDisabled: boolean;
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
  onCopyWorkflow,
  onDeleteWorkflow,
  onOpenWorkflow,
  onPublishWorkflow,
  publishableWorkflowId,
  open,
  workflows,
}: {
  activeWorkflowId: string;
  onCopyWorkflow: (workflow: FlowForgeWorkflowDefinition) => void;
  onDeleteWorkflow: (workflow: FlowForgeWorkflowDefinition) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onPublishWorkflow: (workflow: FlowForgeWorkflowDefinition) => void;
  publishableWorkflowId?: string;
  open: boolean;
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
              workflow={workflow}
              onCopy={() => onCopyWorkflow(workflow)}
              onDelete={() => onDeleteWorkflow(workflow)}
              onOpen={() => onOpenWorkflow(workflow.id)}
              onPublish={() => onPublishWorkflow(workflow)}
              publishEnabled={workflow.id === publishableWorkflowId}
            />
          ))}
        </div>
        {!workflows.length ? <p className="ff-muted">No workflows are available yet.</p> : null}
        <p className="ff-muted">Use the rail to create a persisted draft or save a draft version.</p>
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
  workflow,
}: {
  active: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onPublish: () => void;
  publishEnabled: boolean;
  workflow: FlowForgeWorkflowDefinition;
}) {
  const persisted = /^\d+$/.test(workflow.id);
  return (
    <article className={`ff-workflow-card ${active ? "is-active" : ""}`}>
      <button type="button" className="ff-workflow-card-main" onClick={onOpen} title={workflow.name}>
        <span className="ff-workflow-card-title">{workflow.name}</span>
        <span className="ff-workflow-card-meta">{persisted ? "persisted workflow" : "seed workflow"}</span>
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
  onCreateDraft,
  onCreateBlankWorkflow,
  onSaveVersion,
  createDraftDisabled,
  createBlankDisabled,
  saveVersionDisabled,
}: FlowForgeDesignerRailProps) {
  return (
    <aside className="ncqv2-builder-rail" aria-label="FlowForge designer tools">
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
          icon="fa-file-circle-plus"
          label="Create persisted draft"
          onClick={onCreateDraft}
          disabled={createDraftDisabled}
        />
        <RailButton
          icon="fa-plus"
          label="New blank workflow"
          onClick={onCreateBlankWorkflow}
          disabled={createBlankDisabled}
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
