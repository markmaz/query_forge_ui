import type { Acronym } from "@/features/system-admin/types";

interface AcronymEditorProps {
  value: Acronym[];
  onChange: (acronyms: Acronym[]) => void;
}

export default function AcronymEditor({ value, onChange }: AcronymEditorProps) {
  function updateRow(index: number, patch: Partial<Acronym>) {
    const next = value.map((a, i) => (i === index ? { ...a, ...patch } : a));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, { abbr: "", expansion: "" }]);
  }

  return (
    <div className="sa-dynamic-rows">
      {value.map((acr, i) => (
        <div key={i} className="sa-dynamic-row">
          <div className="flex-1">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Abbreviation"
              value={acr.abbr}
              onChange={(e) => updateRow(i, { abbr: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Expansion"
              value={acr.expansion}
              onChange={(e) => updateRow(i, { expansion: e.target.value })}
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
        <i className="fa fa-plus" /> Add Acronym
      </button>
    </div>
  );
}
