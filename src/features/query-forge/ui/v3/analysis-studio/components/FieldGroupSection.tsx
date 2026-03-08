import type { StudioField, StudioFieldCategory } from "../model/analysisTypes";
import { FieldRow } from "./FieldRow";

type FieldGroupSectionProps = {
  category: StudioFieldCategory;
  expanded: boolean;
  selectedFieldId: string | null;
  onToggle: (categoryId: string) => void;
  onFieldClick: (field: StudioField) => void;
};

export function FieldGroupSection(props: FieldGroupSectionProps) {
  const { category, expanded, selectedFieldId, onToggle, onFieldClick } = props;

  return (
    <section className="analysisFieldGroup">
      <button
        type="button"
        className="analysisFieldGroup__header"
        onClick={() => onToggle(category.id)}
        aria-expanded={expanded}
      >
        <span className="analysisFieldGroup__headerMain">
          <span className="analysisFieldGroup__chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
          <span>{category.label}</span>
        </span>
        <span className="analysisFieldGroup__count">{category.fields.length}</span>
      </button>
      {expanded ? (
        <div className="analysisFieldGroup__rows">
          {category.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              selected={selectedFieldId === String(field.id)}
              onClick={onFieldClick}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
