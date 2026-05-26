import type { FlowForgeWorkflowDefinition } from "../model/types";

type WorkflowTemplateDrawerProps = {
  open: boolean;
  templates: FlowForgeWorkflowDefinition[];
  createPending: boolean;
  onClose: () => void;
  onUseTemplate: (template: FlowForgeWorkflowDefinition) => void;
};

export default function WorkflowTemplateDrawer({
  open,
  templates,
  createPending,
  onClose,
  onUseTemplate,
}: WorkflowTemplateDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button type="button" className="ff-node-config-drawer-backdrop" aria-label="Close workflow templates" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Workflow templates" className="ff-node-config-drawer ff-template-workflow-drawer">
        <header className="ff-node-config-drawer-header">
          <div>
            <div className="ff-eyebrow">Workflow templates</div>
            <h2>Start from template</h2>
          </div>
          <button type="button" className="ff-node-config-drawer-close" aria-label="Close workflow templates" onClick={onClose}>
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="ff-node-config-drawer-body">
          <div className="ff-template-workflow-list">
            {templates.map((template) => (
              <article key={template.id} className="ff-template-workflow-card">
                <div>
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                </div>
                <dl className="ff-template-workflow-meta">
                  <div>
                    <dt>Nodes</dt>
                    <dd>{template.graph.nodes.length}</dd>
                  </div>
                  <div>
                    <dt>Connections</dt>
                    <dd>{template.graph.edges.length}</dd>
                  </div>
                  <div>
                    <dt>Includes</dt>
                    <dd>{Array.from(new Set(template.graph.nodes.map((node) => node.type.replace("_", " ")))).join(", ")}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={createPending}
                  onClick={() => onUseTemplate(template)}
                >
                  Use {template.name} template
                </button>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
