// src/shared/ui/SectionShell.tsx
import React, { useMemo } from "react";

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
      border: "1px solid var(--bs-border-color)",
    }}
    aria-label={`Count: ${count}`}
    title={`${count}`}
  >
    {count}
  </span>
);

export type SectionShellProps = {
  id: string;

  title: string;
  subtitle?: string;

  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapsible?: boolean;

  iconClass?: string;
  count?: number;

  right?: React.ReactNode;

  onHide?: () => void;

  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;

  helpAction?: {
    label?: string;
    ariaLabel?: string;
    iconClass?: string;
    onClick: () => void;
    hidden?: boolean;
  };

  /** Optional fixed body height (Preview uses this) */
  heightPx?: number;

  className?: string;

  children: React.ReactNode;
};

export function SectionShell({
  id,
  title,
  subtitle,
  collapsed,
  onToggleCollapsed,
  collapsible = true,
  iconClass,
  count,
  right,
  onHide,
  isFullscreen,
  onToggleFullscreen,
  helpAction,
  heightPx,
  className,
  children,
}: SectionShellProps) {
  const collapseId = useMemo(() => `collapse-${id}`, [id]);
  const isCollapsible = collapsible !== false;
  const isCollapsed = isCollapsible ? collapsed : false;
  const showHelpAction = Boolean(helpAction && !helpAction.hidden);

  return (
    <div
      className={"card shadow-sm mb-3 w-100" + (className ?? "")}
      style={{
        width: "100%",
        minWidth: 0,
        // ✅ allow this card to stretch in “focus mode” wrappers
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        ...(isFullscreen ? { flex: "1 1 auto", height: "100%" } : null),
      }}
    >
      <div className="card-header bg-white list-mgmt-section-header">
        <div className="d-flex align-items-center w-100">
          {/* LEFT: collapse toggle + title */}
          {isCollapsible ? (
            <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2"
                onClick={onToggleCollapsed}
                aria-expanded={!isCollapsed}
                aria-controls={collapseId}
                style={{ minWidth: 0 }}
              >
                <div className="d-flex align-items-center gap-2" style={{ minWidth: 42 }}>
                  <i
                    className={`fa ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"}`}
                    style={{ width: 14, color: "var(--bs-secondary-color)" }}
                    aria-hidden="true"
                  />
                  {iconClass ? (
                    <i
                      className={`fa ${iconClass}`}
                      style={{ color: "var(--bs-secondary-color)", fontSize: "0.95rem" }}
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

              {showHelpAction ? (
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none small d-inline-flex align-items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    helpAction?.onClick();
                  }}
                  aria-label={helpAction?.ariaLabel ?? `Need help with ${title}`}
                  title={helpAction?.ariaLabel ?? `Need help with ${title}`}
                >
                  <i className={`fa ${helpAction?.iconClass ?? "fa-wand-magic-sparkles"}`} aria-hidden="true" />
                  <span>{helpAction?.label ?? "Need Help"}</span>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
              <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                <div className="d-flex align-items-center gap-2" style={{ minWidth: 28 }}>
                  {iconClass ? (
                    <i
                      className={`fa ${iconClass}`}
                      style={{ color: "var(--bs-secondary-color)", fontSize: "0.95rem" }}
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
              </div>

              {showHelpAction ? (
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none small d-inline-flex align-items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    helpAction?.onClick();
                  }}
                  aria-label={helpAction?.ariaLabel ?? `Need help with ${title}`}
                  title={helpAction?.ariaLabel ?? `Need help with ${title}`}
                >
                  <i className={`fa ${helpAction?.iconClass ?? "fa-wand-magic-sparkles"}`} aria-hidden="true" />
                  <span>{helpAction?.label ?? "Need Help"}</span>
                </button>
              ) : null}
            </div>
          )}

          {/* SPACER pushes the rest to the right */}
          <div className="flex-grow-1" />

          {/* RIGHT SLOT: user-provided actions/badges go BEFORE window controls */}
          {right ? (
            <div className="d-flex align-items-center gap-2 me-2" onClick={(e) => e.stopPropagation()}>
              {right}
            </div>
          ) : null}

          {/* WINDOW CONTROLS: fullscreen + X always last */}
          <div className="d-flex align-items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {onToggleFullscreen ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={onToggleFullscreen}
                title={isFullscreen ? "Exit full screen" : "Full screen"}
                aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "2px 6px",
                  lineHeight: 1,
                  opacity: 0.65,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
              >
                <i className={`fa ${isFullscreen ? "fa-compress" : "fa-expand"}`} />
              </button>
            ) : null}

            {onHide ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={onHide}
                aria-label={`Hide ${title}`}
                title="Hide section"
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "2px 6px",
                  lineHeight: 1,
                  opacity: 0.65,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
              >
                <i className="fa fa-xmark" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        {subtitle ? <div className="text-muted small mt-1">{subtitle}</div> : null}
      </div>

      {!isCollapsed ? (
        <div
          className="card-body"
          id={collapseId}
          style={{
            // ✅ this is the key for focus-mode: body consumes remaining space + can scroll
            flex: "1 1 auto",
            minHeight: 0,
            overflow: isFullscreen ? "auto" : undefined,
            ...(isFullscreen ? { height: "100%" } : null),
          }}
        >
          {heightPx ? (
            <div
              style={{
                height: isFullscreen ? "100%" : heightPx, // ✅ in focus mode, fill available space
                minHeight: 0,
                overflow: isFullscreen ? "auto" : "hidden", // ✅ focus mode scrolls
              }}
            >
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}
