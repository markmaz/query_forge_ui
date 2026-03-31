import type { ForgeMatchDraftResponse } from "../types";

type Props = {
  disableActions: boolean;
  onExport: (format: "csv" | "xlsx") => Promise<void>;
  onCreateDraft: (kind: "view_draft" | "domain_draft") => Promise<void>;
  onOpenWorkarea: () => void;
  onPrint: () => void;
  draftResponse: ForgeMatchDraftResponse | null;
};

export default function ForgeMatchFinalizeBar({
  disableActions,
  onExport,
  onCreateDraft,
  onOpenWorkarea,
  onPrint,
  draftResponse,
}: Props) {
  return (
    <section className="fm-card fm-finalize" aria-label="Finalize mapping actions">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">6. Finalize Mapping</h2>
          <p className="fm-card-subtitle">Export and draft downstream assets from accepted mappings.</p>
        </div>
      </div>

      <div className="fm-finalize-actions">
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={() => void onExport("csv")}>Export CSV</button>
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={() => void onExport("xlsx")}>Export XLSX</button>
        <button type="button" className="btn btn-outline-secondary" disabled={disableActions} onClick={onPrint}>Print</button>
        <button type="button" className="btn btn-outline-primary" disabled={disableActions} onClick={() => void onCreateDraft("view_draft")}>Create View Draft</button>
        <button type="button" className="btn btn-outline-primary" disabled={disableActions} onClick={() => void onCreateDraft("domain_draft")}>Create Domain Draft</button>
        {draftResponse?.editable_sql ? (
          <button type="button" className="btn btn-outline-secondary" onClick={onOpenWorkarea}>Open SQL Workarea</button>
        ) : null}
      </div>

      {draftResponse ? (
        <div className="alert alert-info mb-0" role="status">
          <div>
            Draft artifact created: <strong>{draftResponse.artifact_id}</strong> ({draftResponse.accepted_column_count} accepted columns)
          </div>
          {!draftResponse.is_executable && draftResponse.blocking_reason ? (
            <div className="small mt-2">{draftResponse.blocking_reason}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
