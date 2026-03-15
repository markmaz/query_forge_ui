type Props = {
  summary: string;
};

export default function SkillSummaryPreview({ summary }: Props) {
  return (
    <div className="card border-0 shadow-sm skills-summary-preview">
      <div className="card-body">
        <div className="text-muted text-uppercase small fw-semibold mb-2">Skill Summary</div>
        <p className="mb-0">{summary}</p>
      </div>
    </div>
  );
}
