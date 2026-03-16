import "../../query-forge/ui/styles/queryForgeHero.css";

type Props = {
  onCreate: () => void;
  onBrowseTemplates: () => void;
};

export default function SkillsPageHeader({ onCreate, onBrowseTemplates }: Props) {
  return (
    <header className="skills-page-header qf-hero mb-3">
      <div className="qf-hero-main">
        <h1 className="qf-hero-title">Skills</h1>
        <p className="qf-hero-subtitle mb-0">
          Automate alerts, summaries, and deliveries from your saved queries.
        </p>
      </div>
      <div className="qf-hero-actions">
        <button type="button" className="btn btn-outline-secondary" onClick={onBrowseTemplates}>
          Browse Templates
        </button>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          Create Skill
        </button>
      </div>
    </header>
  );
}
