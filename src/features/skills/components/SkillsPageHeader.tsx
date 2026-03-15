type Props = {
  onCreate: () => void;
  onBrowseTemplates: () => void;
};

export default function SkillsPageHeader({ onCreate, onBrowseTemplates }: Props) {
  return (
    <div className="skills-page-header card border-0 shadow-sm mb-3">
      <div className="card-body d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <h1 className="h3 mb-1">Skills</h1>
          <p className="text-muted mb-0">
            Automate alerts, summaries, and deliveries from your saved queries.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onBrowseTemplates}>
            Browse Templates
          </button>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            Create Skill
          </button>
        </div>
      </div>
    </div>
  );
}
