import React, { useEffect } from "react";
import type { ToolKeyV2 } from "./BuilderToolRailV2";

export function BuilderDrawerV2(props: {
  openTool: ToolKeyV2 | null;
  onClose: () => void;
  childrenByTool: Record<ToolKeyV2, React.ReactNode>;
}) {
  const { openTool, onClose, childrenByTool } = props;
  const isOpen = openTool !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className={`ncqv2-drawer-layer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
      <div className="ncqv2-drawer-backdrop" onClick={onClose} />
      <aside className="ncqv2-drawer" role="dialog" aria-label="Builder drawer">
        {Object.entries(childrenByTool).map(([key, node]) => (
          <div
            key={key}
            className={`ncqv2-drawer-panel ${openTool === key ? "is-active" : ""}`}
            data-tool={key}
          >
            <div className="ncqv2-drawer-content">{node}</div>
          </div>
        ))}
      </aside>
    </div>
  );
}
