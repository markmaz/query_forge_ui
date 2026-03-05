import type { Synonym } from "@/features/system-admin/types";
import TagInput from "./TagInput";

interface SynonymEditorProps {
  value: Synonym[];
  onChange: (synonyms: Synonym[]) => void;
}

export default function SynonymEditor({ value, onChange }: SynonymEditorProps) {
  function updateRow(index: number, patch: Partial<Synonym>) {
    const next = value.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, { term: "", means: [] }]);
  }

  return (
    <div className="sa-dynamic-rows">
      {value.map((syn, i) => (
        <div key={i} className="sa-dynamic-row">
          <div className="flex-1">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Term"
              value={syn.term}
              onChange={(e) => updateRow(i, { term: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <TagInput
              value={syn.means}
              onChange={(means) => updateRow(i, { means })}
              placeholder="Meanings…"
            />
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => removeRow(i)}
          >
            <i className="fa fa-trash" />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addRow}>
        <i className="fa fa-plus" /> Add Synonym
      </button>
    </div>
  );
}
