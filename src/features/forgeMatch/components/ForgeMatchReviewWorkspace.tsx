import ForgeMatchInspector from "./ForgeMatchInspector";
import ForgeMatchQueueList from "./ForgeMatchQueueList";
import ForgeMatchTableView from "./ForgeMatchTableView";
import type { ForgeMatchMapping } from "../types";

type ReviewMode = "queue" | "table";

type Props = {
  mode: ReviewMode;
  onModeChange: (mode: ReviewMode) => void;
  queueRows: ForgeMatchMapping[];
  tableRows: ForgeMatchMapping[];
  selectedMappingId: string | null;
  selectedRow: ForgeMatchMapping | null;
  isSaving?: boolean;
  onSelectMapping: (mappingId: string) => void;
  onAccept: (row: ForgeMatchMapping) => Promise<void>;
  onReject: (row: ForgeMatchMapping) => Promise<void>;
  onNeedsReview: (row: ForgeMatchMapping) => Promise<void>;
  onOpenDrawer: (row: ForgeMatchMapping) => void;
  onManualRemap: (row: ForgeMatchMapping) => void;
  onEditNotes: (row: ForgeMatchMapping) => void;
};

export default function ForgeMatchReviewWorkspace({
  mode,
  onModeChange,
  queueRows,
  tableRows,
  selectedMappingId,
  selectedRow,
  isSaving,
  onSelectMapping,
  onAccept,
  onReject,
  onNeedsReview,
  onOpenDrawer,
  onManualRemap,
  onEditNotes,
}: Props) {
  return (
    <section className="fm-card" aria-label="ForgeMatch review workspace">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">5. Review Workspace</h2>
          <p className="fm-card-subtitle">Queue-first triage for guided review, with table mode for power users.</p>
        </div>

        <div className="btn-group" role="group" aria-label="Review view mode">
          <button
            type="button"
            className={`btn btn-sm ${mode === "queue" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => onModeChange("queue")}
          >
            Queue View
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === "table" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => onModeChange("table")}
          >
            Table View
          </button>
        </div>
      </div>

      {mode === "queue" ? (
        <div className="fm-review-split">
          <ForgeMatchQueueList rows={queueRows} selectedMappingId={selectedMappingId} onSelect={onSelectMapping} />
          <ForgeMatchInspector
            row={selectedRow}
            isSaving={isSaving}
            onAccept={onAccept}
            onReject={onReject}
            onNeedsReview={onNeedsReview}
            onManualRemap={onManualRemap}
            onEditNotes={onEditNotes}
            onOpenDrawer={onOpenDrawer}
          />
        </div>
      ) : (
        <ForgeMatchTableView
          rows={tableRows}
          isSaving={isSaving}
          onAccept={onAccept}
          onReject={onReject}
          onNeedsReview={onNeedsReview}
          onOpenDrawer={onOpenDrawer}
          onManualRemap={onManualRemap}
          onEditNotes={onEditNotes}
        />
      )}
    </section>
  );
}

export type { ReviewMode };
