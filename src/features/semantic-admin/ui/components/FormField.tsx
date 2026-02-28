import React from "react";

type Props = {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
};

export function FormField({ label, hint, error, htmlFor, children }: Props) {
  return (
    <div className="semantic-admin-field mb-3">
      {htmlFor ? (
        <>
          <label className="semantic-admin-field-label" htmlFor={htmlFor}>
            {label}
          </label>
          {children}
        </>
      ) : (
        <label className="semantic-admin-field-label">
          <span>{label}</span>
          <div className="mt-1">{children}</div>
        </label>
      )}
      {hint ? <div className="semantic-admin-field-hint">{hint}</div> : null}
      {error ? <div className="semantic-admin-field-error">{error}</div> : null}
    </div>
  );
}

export default FormField;
