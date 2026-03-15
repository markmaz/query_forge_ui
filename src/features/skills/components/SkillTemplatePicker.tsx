import type { SkillTemplate } from "../types";

type Props = {
  templates: SkillTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
};

export default function SkillTemplatePicker({ templates, selectedTemplateId, onSelectTemplate }: Props) {
  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h3 className="h6 mb-0">Starter Templates</h3>
        <span className="text-muted small">Pick one, then customize everything.</span>
      </div>
      <div className="row g-2">
        {templates.map((template) => {
          const selected = selectedTemplateId === template.id;
          return (
            <div className="col-md-6" key={template.id}>
              <button
                type="button"
                className={`skills-template-card h-100 text-start ${selected ? "is-selected" : ""}`}
                onClick={() => onSelectTemplate(template.id)}
              >
                <div className="fw-semibold mb-1">{template.name}</div>
                <div className="small text-muted">{template.description}</div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
