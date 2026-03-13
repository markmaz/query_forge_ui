import type { ForgeMatchMapping } from "../types";
import ForgeMatchResultsTable from "./ForgeMatchResultsTable";

type Props = {
  rows: ForgeMatchMapping[];
  isSaving?: boolean;
  onAccept: (row: ForgeMatchMapping) => Promise<void>;
  onReject: (row: ForgeMatchMapping) => Promise<void>;
  onNeedsReview: (row: ForgeMatchMapping) => Promise<void>;
  onOpenDrawer: (row: ForgeMatchMapping) => void;
  onManualRemap: (row: ForgeMatchMapping) => void;
  onEditNotes: (row: ForgeMatchMapping) => void;
};

export default function ForgeMatchTableView(props: Props) {
  return (
    <div className="fm-table-view">
      <ForgeMatchResultsTable {...props} />
    </div>
  );
}
