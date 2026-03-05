import { useState, useRef, type KeyboardEvent } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  return (
    <div className="sa-tag-input-wrap" onClick={() => inputRef.current?.focus()}>
      {value.map((tag, i) => (
        <span key={tag} className="sa-tag">
          {tag}
          <button
            type="button"
            className="sa-tag-remove"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
          >
            <i className="fa fa-times" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="sa-tag-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={value.length === 0 ? placeholder : ""}
      />
    </div>
  );
}
