import React from "react";

type Option = {
  label: string;
  value: string | number;
};

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Option[];
  placeholder?: string;
};

export function SelectField({ options, placeholder, ...props }: Props) {
  return (
    <select {...props} className={`form-select ${props.className ?? ""}`.trim()}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default SelectField;

