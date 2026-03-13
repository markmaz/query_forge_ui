import { useRef, useState } from "react";

import type { ForgeMatchSessionRecord } from "../types";

type Props = {
  disabled?: boolean;
  isUploading?: boolean;
  session: ForgeMatchSessionRecord | null;
  onUpload: (file: File) => Promise<void>;
};

export default function ForgeMatchUploadCard({ disabled, isUploading, session, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;
    await onUpload(selectedFile);
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="fm-card" aria-label="ForgeMatch upload stage">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">1. Upload Mapping Document</h2>
          <p className="fm-card-subtitle">Upload a CSV or XLSX source mapping from your external system.</p>
        </div>
      </div>

      <div className="fm-upload-shell">
        <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
          <div className="col-lg-8">
            <label htmlFor="forge-match-file" className="form-label">File</label>
            <input
              ref={inputRef}
              id="forge-match-file"
              type="file"
              className="form-control"
              accept=".csv,.xlsx"
              disabled={disabled || isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
            />
          </div>
          <div className="col-lg-4 d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={disabled || isUploading || !selectedFile}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>

        {selectedFile ? (
          <div className="fm-selected-file" role="status">
            <div className="fm-selected-file-name">{selectedFile.name}</div>
            <div className="fm-selected-file-meta">{Math.max(1, Math.round(selectedFile.size / 1024)).toLocaleString()} KB</div>
          </div>
        ) : null}

        {session ? (
          <div className="fm-upload-meta-grid" aria-label="Uploaded file metadata">
            <div className="fm-upload-meta-item">
              <span>Filename</span>
              <strong>{session.uploaded_filename}</strong>
            </div>
            <div className="fm-upload-meta-item">
              <span>Sheets</span>
              <strong>{session.sheet_count}</strong>
            </div>
            <div className="fm-upload-meta-item">
              <span>Detected Fields</span>
              <strong>{session.source_record_count}</strong>
            </div>
            <div className="fm-upload-meta-item">
              <span>Session</span>
              <strong>{session.id}</strong>
            </div>
          </div>
        ) : (
          <div className="fm-empty-upload-state" role="status">
            <div className="fm-empty-upload-glyph" aria-hidden="true">↑</div>
            <div>
              <strong>No source document yet.</strong>
              <p>Upload a mapping file to start extraction and analysis.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
