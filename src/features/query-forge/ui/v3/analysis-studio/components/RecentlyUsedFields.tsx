import type { StudioField } from "../model/analysisTypes";
import { FieldRow } from "./FieldRow";

type RecentlyUsedFieldsProps = {
  fields: StudioField[];
  selectedFieldId: string | null;
  onFieldClick: (field: StudioField) => void;
};

export function RecentlyUsedFields(props: RecentlyUsedFieldsProps) {
  const { fields, selectedFieldId, onFieldClick } = props;

  if (fields.length === 0) {
    return <p className="analysisHint">Click fields as you explore to pin recent selections here.</p>;
  }

  return (
    <div className="analysisRecentFields">
      {fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          selected={selectedFieldId === String(field.id)}
          onClick={onFieldClick}
        />
      ))}
    </div>
  );
}
