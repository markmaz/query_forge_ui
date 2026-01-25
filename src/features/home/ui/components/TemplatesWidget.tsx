// src/features/no-code-sql/ui/components/home/TemplatesWidget.tsx
import React from "react";

export type TemplateCard = {
  id: string;
  title: string;
  description: string;
  tag?: string;
};

export type TemplatesWidgetProps = {
  templates: TemplateCard[];
  onUseTemplate: (id: string) => void;
  onBrowseAll?: () => void;
};

const TemplatesWidget: React.FC<TemplatesWidgetProps> = ({ templates, onUseTemplate, onBrowseAll }) => {
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-body d-flex align-items-center justify-content-between">
        <div className="fw-semibold">Templates & starters</div>
        <button className="btn btn-link btn-sm text-decoration-none" type="button" onClick={onBrowseAll}>
          Browse all
        </button>
      </div>

      <div className="card-body">
        <div className="row g-2">
          {templates.slice(0, 6).map((t) => (
            <div key={t.id} className="col-12 col-md-6 col-xl-4">
              <div className="card border h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div className="fw-semibold">{t.title}</div>
                    {t.tag ? <span className="badge text-bg-light border">{t.tag}</span> : null}
                  </div>
                  <div className="text-muted small mt-2" style={{ lineHeight: 1.4 }}>
                    {t.description}
                  </div>
                  <div className="mt-auto pt-3">
                    <button className="btn btn-outline-secondary btn-sm w-100" type="button" onClick={() => onUseTemplate(t.id)}>
                      Use template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {templates.length === 0 ? <div className="text-muted">No templates yet.</div> : null}
        </div>
      </div>
    </div>
  );
};

export default TemplatesWidget;