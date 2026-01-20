import React from "react";

export function SavedQueriesRail({
  topOffset = 96,
  heightOffset = 120,
  onOpen,
  onNew,
}: {
  topOffset?: number;
  heightOffset?: number;
  onOpen: () => void;
  onNew?: () => void;
}) {
  return (
    <div
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
      className="d-flex flex-column align-items-center py-2 gap-2 shadow-sm"
      aria-label="Saved Queries rail"
    >
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        title="Saved Queries"
        onClick={onOpen}
        style={{ width: 34, height: 34, padding: 0 }}
      >
        <i className="fa fa-folder-open" aria-hidden="true" />
      </button>

      {onNew ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          title="New Query"
          onClick={onNew}
          style={{ width: 34, height: 34, padding: 0 }}
        >
          <i className="fa fa-plus" aria-hidden="true" />
        </button>
      ) : null}

      <div className="flex-grow-1" />

      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        title="Open Saved Queries"
        onClick={onOpen}
        style={{ width: 34, height: 34, padding: 0 }}
      >
        <i className="fa fa-chevron-left" aria-hidden="true" />
      </button>
    </div>
  );
}