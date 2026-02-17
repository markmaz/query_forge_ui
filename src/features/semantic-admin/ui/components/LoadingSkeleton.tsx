import React from "react";

type Props = {
  lines?: number;
};

export function LoadingSkeleton({ lines = 3 }: Props) {
  return (
    <div className="semantic-admin-card p-3">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="placeholder-glow mb-2"
          aria-hidden="true"
        >
          <span className="placeholder col-12" />
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;

