import React from "react";

type Props = {
  message?: string | null;
  onDismiss?: () => void;
};

export function ApiErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null;
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="btn btn-sm btn-outline-light" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export default ApiErrorBanner;

