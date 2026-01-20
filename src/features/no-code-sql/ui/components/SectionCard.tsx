import React, { useMemo, useRef, useState } from "react";

const CountCircle: React.FC<{ count: number }> = ({ count }) => (
  <span
    className="badge bg-light text-dark"
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      borderRadius: 999,
      fontSize: "0.75rem",
      lineHeight: 1,
      border: "1px solid rgba(0,0,0,0.12)",
    }}
    aria-label={`Count: ${count}`}
    title={`${count}`}
  >
    {count}
  </span>
);

export function SectionCard(props: {
  title: string;
  subtitle?: string;

  collapsed: boolean;
  onToggle: () => void;

  iconClass?: string; // e.g. "fa-wand-magic-sparkles"
  count?: number;

  right?: React.ReactNode;
  children: React.ReactNode;

  className?: string;
}) {
  const {
    title,
    subtitle,
    collapsed,
    onToggle,
    iconClass,
    count,
    right,
    children,
    className,
  } = props;

  const collapseId = useMemo(() => {
    const slug = title
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .join("-");
    return `collapse-${slug}`;
  }, [title]);

  return (
    <div className={"card shadow-sm mb-3 " + (className ?? "")}>
      <div className="card-header bg-white list-mgmt-section-header">
        <div className="d-flex align-items-center justify-content-between">
          <button
            type="button"
            className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-controls={collapseId}
          >
            {/* Chevron + icon block */}
            <div className="d-flex align-items-center gap-2" style={{ minWidth: 42 }}>
              <i
                className={`fa ${collapsed ? "fa-chevron-right" : "fa-chevron-down"}`}
                style={{ width: 14, color: "rgba(0,0,0,0.55)" }}
                aria-hidden="true"
              />
              {iconClass ? (
                <i
                  className={`fa ${iconClass}`}
                  style={{ color: "rgba(0,0,0,0.65)", fontSize: "0.95rem" }}
                  aria-hidden="true"
                />
              ) : (
                <span style={{ width: 14 }} />
              )}
            </div>

            <span className="fw-semibold text-dark" style={{ fontSize: "0.95rem" }}>
              {title}
            </span>

            {typeof count === "number" ? <CountCircle count={count} /> : null}
          </button>

          {/* Right-side actions */}
          <div className="d-flex gap-2" onClick={(e) => e.stopPropagation()}>
            {right}
          </div>
        </div>

        {subtitle ? <div className="text-muted small mt-1">{subtitle}</div> : null}
      </div>

      {!collapsed ? (
        <div className="card-body" id={collapseId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}