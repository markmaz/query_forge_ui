import { useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  isUploading?: boolean;
  onUpload: (file: File) => Promise<void>;
};

export default function ForgeMatchUpload({ disabled, isUploading, onUpload }: Props) {
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
    <section className="fm-card" aria-label="ForgeMatch upload">
      <h2 className="fm-card-title">1. Upload Mapping Document</h2>
      <p className="fm-card-subtitle">
        Upload a CSV or Excel mapping document from your source system.
      </p>

      <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
        <div className="col-md-8">
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
        <div className="col-md-4 d-flex gap-2">
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
        <div className="small text-muted mt-2">
          Selected: <strong>{selectedFile.name}</strong>
        </div>
      ) : null}
    </section>
  );
}
