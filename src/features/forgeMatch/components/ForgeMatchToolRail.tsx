export default function ForgeMatchToolRail({
  sessionsOpen,
  onToggleSessions,
}: {
  sessionsOpen: boolean;
  onToggleSessions: () => void;
}) {
  return (
    <aside className="ncqv2-builder-rail" aria-label="ForgeMatch tools">
      <div className="ncqv2-rail-top">
        <button
          type="button"
          className={`btn btn-sm ${sessionsOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={onToggleSessions}
          aria-pressed={sessionsOpen}
          aria-label={sessionsOpen ? "Hide sessions" : "Show sessions"}
          title={sessionsOpen ? "Hide sessions" : "Show sessions"}
        >
          <i className="fa fa-folder-open" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
