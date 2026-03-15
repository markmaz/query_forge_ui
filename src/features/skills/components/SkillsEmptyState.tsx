import type { SkillTemplate } from "../types";

type Props = {
  templates: SkillTemplate[];
  onCreate: () => void;
  onUseTemplate: (templateId: string) => void;
};

export default function SkillsEmptyState({ templates, onCreate, onUseTemplate }: Props) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <div className="text-center mb-4">
          <div className="skills-empty-icon mb-2" aria-hidden="true">
            <i className="fa fa-bolt" />
          </div>
          <h2 className="h5 mb-1">No skills yet</h2>
          <p className="text-muted mb-3">
            Skills automate triggers, conditions, and actions for your saved queries.
          </p>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            Create Skill
          </button>
        </div>

        <div className="row g-3">
          {templates.map((template) => (
            <div key={template.id} className="col-md-6 col-xl-4">
              <button
                type="button"
                className="skills-template-card h-100 text-start"
                onClick={() => onUseTemplate(template.id)}
              >
                <div className="fw-semibold mb-1">{template.name}</div>
                <div className="small text-muted">{template.description}</div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
