import React, { useEffect, useMemo, useRef, useState } from "react";

export type SectionKey = "regions" | "npiCategories" | "serviceLines";

export type UploadError = {
  rowNumber: number;
  column?: string;
  code: string;
  message: string;
  value?: string;
};

export type UploadResult = {
  uploadId: string;
  inferredType: SectionKey;
  status: "SUCCESS" | "FAILED";
  insertedCount: number;
  totalCount: number;

  listId?: string;
  listName?: string;
  createdAt?: string;
  updatedAt?: string;
  owner?: string;

  errors?: UploadError[];
};

type Step = "PICK_FILE" | "PROCESSING" | "SUMMARY";

export default function UploadWizardModal(props: {
  open: boolean;
  section: SectionKey;
  initialFile?: File | null;
  onClose: () => void;
  onSuccess: (result: UploadResult) => void;
  uploadAndValidate: (file: File, listName: string, isShared: boolean) => Promise<UploadResult>;
}) {
  const { open, section, initialFile, onClose, onSuccess, uploadAndValidate } = props;

  const [step, setStep] = useState<Step>("PICK_FILE");
  const [file, setFile] = useState<File | null>(null);
  const [listName, setListName] = useState("");
  const [isShared, setIsShared] = useState(false);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // ✅ non-null ref type
  const listNameInputRef = useRef<HTMLInputElement>(null!);

  const startWithFileAndName = async (f: File, name: string, shared: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setFatalError(null);
    setStep("PROCESSING");

    try {
      const r = await uploadAndValidate(f, trimmed, shared);
      setResult(r);
      setStep("SUMMARY");

      if (r.status === "SUCCESS") onSuccess(r);
    } catch (e: any) {
      setFatalError(e?.message ?? "Upload failed unexpectedly.");
      setStep("SUMMARY");
    } finally {
      setBusy(false);
    }
  };

  // ✅ Reset when modal opens, and seed a sensible default name based on section.
  useEffect(() => {
    if (!open) return;

    setStep("PICK_FILE");
    setFile(initialFile ?? null);              // keep dropped file if provided
    setListName(defaultListName(section));     // ✅ don't wipe it out
    setIsShared(false);
    setBusy(false);
    setResult(null);
    setFatalError(null);

    setTimeout(() => listNameInputRef.current?.focus(), 0);
  }, [open, section, initialFile]);

  // ✅ If initialFile arrives after open (drag/drop timing), adopt it once.
  useEffect(() => {
    if (!open) return;
    if (!initialFile) return;

    setFile((prev) => prev ?? initialFile);
    setTimeout(() => listNameInputRef.current?.focus(), 0);
  }, [open, initialFile]);

  const canStart = Boolean(file) && listName.trim().length > 0 && !busy;

  const start = async () => {
    if (!file) return;
    await startWithFileAndName(file, listName, isShared);
  };

  const title = useMemo(() => {
    if (step === "PICK_FILE") return "Upload List";
    if (step === "PROCESSING") return "Uploading & Validating";
    return "Upload Summary";
  }, [step]);

  if (!open) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-0">{title}</h5>
                <div className="text-muted small">
                  Step {step === "PICK_FILE" ? "1" : step === "PROCESSING" ? "2" : "3"} of 3
                </div>
              </div>

              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={busy} />
            </div>

            <div className="modal-body">
              {step === "PICK_FILE" && (
                <WizardStepPickFile
                  section={section}                 // ✅ pass it down
                  file={file}
                  setFile={setFile}
                  listName={listName}
                  setListName={setListName}
                  isShared={isShared}
                  setIsShared={setIsShared}
                  listNameInputRef={listNameInputRef}
                  disabled={busy}
                  onSubmit={() => {
                    if (canStart) void start();
                  }}
                />
              )}

              {step === "PROCESSING" && <WizardStepProcessing file={file} listName={listName.trim()} />}

              {step === "SUMMARY" && <WizardStepSummary result={result} fatalError={fatalError} />}
            </div>

            <div className="modal-footer">
              {step === "PICK_FILE" && (
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={start} disabled={!canStart}>
                    Upload & Validate
                  </button>
                </>
              )}

              {step === "PROCESSING" && (
                <button type="button" className="btn btn-outline-secondary" disabled>
                  Working…
                </button>
              )}

              {step === "SUMMARY" && (
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                    Close
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setStep("PICK_FILE");
                      setFile(null);
                      setListName(defaultListName(section)); // ✅ better than ""
                      setIsShared(false);
                      setResult(null);
                      setFatalError(null);
                      setTimeout(() => listNameInputRef.current?.focus(), 0);
                    }}
                    disabled={busy}
                  >
                    Upload Another
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop fade show" />
    </>
  );
}

function defaultListName(section: SectionKey) {
  const date = new Date().toISOString().slice(0, 10);
  switch (section) {
    case "regions":
      return `Regions Upload ${date}`;
    case "npiCategories":
      return `NPI Categories Upload ${date}`;
    case "serviceLines":
      return `Service Lines Upload ${date}`;
    default:
      return `List Upload ${date}`;
  }
}

/** Step 1 */
function WizardStepPickFile(props: {
  section: SectionKey;
  file: File | null;
  setFile: (f: File | null) => void;

  listName: string;
  setListName: (s: string) => void;
  isShared: boolean;
  setIsShared: (v: boolean) => void;

  // ✅ non-null ref
  listNameInputRef: React.RefObject<HTMLInputElement>;

  disabled?: boolean;
  onSubmit?: () => void;
}) {
  const {
    file,
    setFile,
    listName,
    setListName,
    isShared,
    setIsShared,
    listNameInputRef,
    disabled = false,
    onSubmit,
    section,
  } = props;

  const onPick: React.ChangeEventHandler<HTMLInputElement> = e => {
    setFile(e.target.files?.[0] ?? null);
    // allow re-picking same file
    e.target.value = "";
  };

  const listNameOk = listName.trim().length > 0;

  return (
    <div>
      <div className="mb-2 text-muted small">
          Uploading for:{" "}
          <span className="fw-semibold text-dark">
            {prettyType(section)}
          </span>
      </div>
      <div className="mb-3">
        <label className="form-label">List name</label>
        <input
          ref={listNameInputRef}
          className={`form-control ${!listNameOk && listName.length > 0 ? "is-invalid" : ""}`}
          value={listName}
          onChange={e => setListName(e.target.value)}
          placeholder="e.g., Northeast Regions v1"
          disabled={disabled}
          onKeyDown={e => {
            if (e.key === "Enter" && onSubmit) onSubmit();
          }}
        />
        <div className="form-text">This name will be applied to all rows and shown in your Lists table.</div>
      </div>

      <div className="mb-3">
        <label className="form-check form-switch m-0">
          <input
            className="form-check-input"
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            disabled={disabled}
          />
          <span className="form-check-label">Share with workspace</span>
        </label>
      </div>

      {!file && (
        <div className="mb-3">
          <label className="form-label">Choose file</label>
          <input
            className="form-control"
            type="file"
            accept=".csv,.xlsx"
            onChange={onPick}
            disabled={disabled}
          />
          <div className="form-text">
            CSV or Excel. We’ll auto-detect list type and validate rows.
          </div>
        </div>
      )}

      {file && (
        <div className="border rounded p-3 bg-light d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <i className="fa fa-file-excel text-muted" aria-hidden="true" />
              <div>
                <div className="fw-semibold text-dark">{file.name}</div>
                <div className="text-secondary small">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setFile(null)}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

/** Step 2 */
function WizardStepProcessing(props: { file: File | null; listName: string }) {
  return (
    <div className="d-flex align-items-start gap-3">
      <div className="spinner-border" role="status" aria-label="Loading" />
      <div>
        <div className="fw-semibold">Uploading & validating…</div>
        <div className="text-muted small">
          We’re inferring list type from columns and validating every row against business rules.
        </div>
        {props.listName && <div className="text-muted small mt-2">List name: {props.listName}</div>}
        {props.file && <div className="text-muted small mt-1">File: {props.file.name}</div>}
      </div>
    </div>
  );
}

/** Step 3 */
function WizardStepSummary(props: { result: UploadResult | null; fatalError: string | null }) {
  const { result, fatalError } = props;

  if (fatalError) {
    return (
      <div className="alert alert-danger mb-0">
        <div className="fw-semibold">Upload failed</div>
        <div className="small">{fatalError}</div>
      </div>
    );
  }

  if (!result) {
    return <div className="text-muted">No result available.</div>;
  }

  const ok = result.status === "SUCCESS";

  return (
    <div>
      <div className={`alert ${ok ? "alert-success" : "alert-warning"}`}>
        <div className="fw-semibold">{ok ? "Upload completed successfully" : "Upload failed validation"}</div>

        <div className="small">
          Detected type: <span className="fw-medium">{prettyType(result.inferredType)}</span>
        </div>

        <div className="small">
          Records: <span className="fw-medium">{result.insertedCount} inserted</span> / {result.totalCount} total
        </div>

        {ok && result.listName && (
          <div className="small mt-1">
            List: <span className="fw-medium">{result.listName}</span>
          </div>
        )}
      </div>

      {!ok && result.errors?.length ? (
        <div>
          <div className="fw-semibold mb-2">Errors</div>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "12%" }}>Row</th>
                  <th style={{ width: "18%" }}>Column</th>
                  <th style={{ width: "20%" }}>Code</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.slice(0, 200).map((e, idx) => (
                  <tr key={idx}>
                    <td>{e.rowNumber}</td>
                    <td className="text-muted">{e.column ?? "-"}</td>
                    <td>
                      <span className="badge text-bg-light border">{e.code}</span>
                    </td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.errors.length > 200 && <div className="text-muted small">Showing first 200 errors…</div>}
        </div>
      ) : null}
    </div>
  );
}

function prettyType(t: SectionKey) {
  if (t === "regions") return "Regions";
  if (t === "npiCategories") return "NPI Categories";
  return "Service Lines";
}
