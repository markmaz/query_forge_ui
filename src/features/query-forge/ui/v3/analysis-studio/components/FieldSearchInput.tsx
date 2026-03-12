type FieldSearchInputProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function FieldSearchInput(props: FieldSearchInputProps) {
  const { value, disabled = false, onChange } = props;

  return (
    <label className="analysisField">
      <span>Search fields</span>
      <input
        value={value}
        disabled={disabled}
        placeholder="Search fields, paths, categories, aliases..."
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
