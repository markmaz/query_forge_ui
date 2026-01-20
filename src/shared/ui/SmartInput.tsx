import React, { useState} from "react";

type SmartInputProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  name?: string;
  defaultText: string;
};

const SmartInput: React.FC<SmartInputProps> = ({
  value,
  onChange,
  onBlur, 
  name,
  defaultText,
}) => {
  const [inputValue, setInputValue] = useState(value || "");
  const [isFocused, setIsFocused] = useState(false);

  const handleBlur = () => {
    setIsFocused(false);
    if (!inputValue) {
      setInputValue(defaultText);
    }
  };

  return (
    <input
      className="form-control"
      name={name}
      value={isFocused && inputValue === defaultText ? "" : inputValue}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        handleBlur();
        onBlur?.();
      }}
      onChange={(e) => {
        const newVal = e.target.value;
        setInputValue(newVal);
        onChange(e);
      }}
    />
  );
};


export default SmartInput;
