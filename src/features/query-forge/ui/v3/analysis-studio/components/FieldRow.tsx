import type { StudioField } from "../model/analysisTypes";

type FieldRowProps = {
  field: StudioField;
  selected: boolean;
  onClick: (field: StudioField) => void;
};

export function FieldRow(props: FieldRowProps) {
  const { field, selected, onClick } = props;

  return (
    <button
      type="button"
      className={`analysisFieldRow ${selected ? "is-selected" : ""}`}
      onClick={() => onClick(field)}
      title={field.path}
    >
      <span className="analysisFieldRow__label">{field.label}</span>
      <span className="analysisFieldRow__path">{field.path}</span>
    </button>
  );
}
