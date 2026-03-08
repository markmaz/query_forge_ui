import type { StudioField, StudioFieldCategory } from "../model/analysisTypes";
import { FieldGroupSection } from "./FieldGroupSection";

type FieldGroupListProps = {
  categories: StudioFieldCategory[];
  searchValue: string;
  expandedGroups: Record<string, boolean>;
  selectedFieldId: string | null;
  onToggleGroup: (categoryId: string) => void;
  onFieldClick: (field: StudioField) => void;
};

export function FieldGroupList(props: FieldGroupListProps) {
  const { categories, searchValue, expandedGroups, selectedFieldId, onToggleGroup, onFieldClick } = props;
  const normalizedSearch = searchValue.trim();

  if (categories.length === 0) {
    return (
      <div className="analysisPanel__empty">
        {normalizedSearch ? (
          <>
            <h3>No fields matched "{normalizedSearch}"</h3>
            <p>Try a different term or check the selected domain.</p>
          </>
        ) : (
          <>
            <h3>No fields available</h3>
            <p>This domain does not have explorer fields yet.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="analysisFieldGroupList">
      {categories.map((category) => (
        <FieldGroupSection
          key={category.id}
          category={category}
          expanded={normalizedSearch ? true : (expandedGroups[category.id] ?? false)}
          selectedFieldId={selectedFieldId}
          onToggle={onToggleGroup}
          onFieldClick={onFieldClick}
        />
      ))}
    </div>
  );
}
