import type { SuggestedNextAction } from "../model/analysisTypes";

type NextStepSuggestionsProps = {
  title?: string;
  actions: SuggestedNextAction[];
  onActionClick: (action: SuggestedNextAction) => void;
};

export function NextStepSuggestions(props: NextStepSuggestionsProps) {
  const { title = "Choose next step", actions, onActionClick } = props;

  if (actions.length === 0) return null;

  return (
    <section className="nextStepSuggestions">
      <header className="nextStepSuggestions__header">
        <h4>{title}</h4>
      </header>
      <div className="nextStepSuggestions__actions">
        {actions.map((action) => (
          <button key={action.id} type="button" onClick={() => onActionClick(action)}>
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
