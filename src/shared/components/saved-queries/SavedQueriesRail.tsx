import React from "react";

type SavedQueriesRailProps = {
  topOffset?: number;
  heightOffset?: number;
  onOpen: () => void;
  onNew?: () => void;
};

const BUTTON_SIZE = 34;

function RailButton({
  title,
  iconClass,
  onClick,
}: {
  title: string;
  iconClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      title={title}
      onClick={onClick}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, padding: 0 }}
    >
      <i className={iconClass} aria-hidden="true" />
    </button>
  );
}

export function SavedQueriesRail({
  topOffset = 96,
  heightOffset = 120,
  onOpen,
  onNew,
}: SavedQueriesRailProps) {
  return (
    <aside
      aria-label="Saved Queries rail"
      className="d-flex flex-column align-items-center py-2 gap-2 shadow-sm"
      style={{
        position: "fixed",
        top: topOffset,
        right: 0,
        width: 44,
        height: `calc(100vh - ${heightOffset}px)`,
        zIndex: 1030,
        borderLeft: "1px solid rgba(0,0,0,0.12)",
        background: "#fff",
      }}
    >
      <RailButton title="Saved Queries" iconClass="fa fa-folder-open" onClick={onOpen} />

      {onNew ? (
        <RailButton title="New Query" iconClass="fa fa-plus" onClick={onNew} />
      ) : null}

      <div className="flex-grow-1" />

      <RailButton title="Open Saved Queries" iconClass="fa fa-chevron-left" onClick={onOpen} />
    </aside>
  );
}
