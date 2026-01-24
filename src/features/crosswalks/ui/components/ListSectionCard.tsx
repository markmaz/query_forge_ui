import React, { useMemo, useRef, useState } from "react";

export type SectionKey = "regions" | "npiCategories" | "serviceLines";

export type ListRow = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  isShared?: boolean;
  expiresAt?: string | null;
  rowCount?: number;
  listType?: SectionKey;
};

const CountCircle: React.FC<{ count: number }> = ({ count }) => (
  <span
    className="badge bg-light text-dark"
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      borderRadius: 999,
      fontSize: "0.75rem",
      lineHeight: 1,
      border: "1px solid var(--bs-border-color)",
    }}
    aria-label={`Count: ${count}`}
    title={`${count}`}
  >
    {count}
  </span>
);

function sectionIcon(section: SectionKey) {
  switch (section) {
    case "regions":
      return "fa-map-location-dot";
    case "npiCategories":
      return "fa-id-card";
    case "serviceLines":
      return "fa-sitemap";
    default:
      return "fa-list";
  }
}

function SkeletonRow() {
  return (
    <tr>
      <td>
        <span className="skeleton skeleton-text w-75" />
      </td>
      <td>
        <span className="skeleton skeleton-text w-50" />
      </td>
      <td>
        <span className="skeleton skeleton-text w-50" />
      </td>
      <td>
        <span className="skeleton skeleton-text w-25" />
      </td>
      <td>
        <span className="skeleton skeleton-text w-50" />
      </td>
    </tr>
  );
}

export default function ListSectionCard(props: {
  section: SectionKey;
  title: string;
  rows: ListRow[];
  loading?: boolean; // ✅ NEW
  collapsed: boolean;
  onToggle: () => void;
  onGenerateTemplate: () => void;

  // accepts dropped file
  onUploadClick: (file?: File) => void;

  onPreview: (row: ListRow) => void;
  onDelete: (row: ListRow) => void;

}) {
  const {
    section,
    title,
    rows,
    loading = false,
    collapsed,
    onToggle,
    onGenerateTemplate,
    onUploadClick,
    onPreview,
    onDelete
  } = props;

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const collapseId = useMemo(
    () => `collapse-${title.toLowerCase().replace(/\s+/g, "-")}`,
    [title]
  );

  const count = rows.length;

  const onFilePicked: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onUploadClick(f);
    e.target.value = "";
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const f = e.dataTransfer.files?.[0];
    if (f) onUploadClick(f);
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-white list-mgmt-section-header">
        <div className="d-flex align-items-center justify-content-between">
          <button
            type="button"
            className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-controls={collapseId}
          >
            {/* ✅ Chevron + section icon block */}
            <div className="d-flex align-items-center gap-2" style={{ minWidth: 42 }}>
              {/* ✅ Updated chevron usage: right/down */}
              <i
                className={`fa ${collapsed ? "fa-chevron-right" : "fa-chevron-down"}`}
                style={{ width: 14, color: "var(--bs-secondary-color)" }}
                aria-hidden="true"
              />

              {/* Section icon */}
              <i
                className={`fa ${sectionIcon(section)}`}
                style={{ color: "var(--bs-secondary-color)", fontSize: "0.95rem" }}
                aria-hidden="true"
              />
            </div>

            <span className="fw-semibold text-dark" style={{ fontSize: "0.95rem" }}>
              {title}
            </span>

            <CountCircle count={count} />
          </button>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onGenerateTemplate}
              disabled={loading}
            >
              Generate Template
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onUploadClick()}
              disabled={loading}
            >
              <i className="fa fa-upload me-1" aria-hidden="true" />
              Upload List
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="d-none"
              accept=".csv,.xlsx"
              onChange={onFilePicked}
            />
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="card-body" id={collapseId}>
          {/* ✅ Skeleton view while loading */}
          {loading ? (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "30%" }}>List Name</th>
                    <th style={{ width: "18%" }}>Date Created</th>
                    <th style={{ width: "18%" }}>Last Updated</th>
                    <th style={{ width: "14%" }}>Preview</th>
                    <th style={{ width: "20%" }}>Owner</th>
                    <th style={{ width: "4%" }} className="text-end"></th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : rows.length === 0 ? (
            <div
              className="rounded p-4"
              style={{
                minHeight: 200,
                cursor: "pointer",
                background: isDragOver
                  ? "linear-gradient(135deg, rgba(13,110,253,0.08), rgba(13,110,253,0.02))"
                  : "linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.01))",
                border: isDragOver
                  ? "1px dashed rgba(13,110,253,0.55)"
                  : "1px dashed rgba(0,0,0,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              role="button"
              tabIndex={0}
              onClick={() => onUploadClick()}
              onKeyDown={(e) => (e.key === "Enter" ? onUploadClick() : null)}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div style={{ maxWidth: 560, width: "100%" }}>
                <div
                  className="rounded mb-3"
                  style={{
                    height: 90,
                    background:
                      "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.06), transparent 55%)," +
                      "radial-gradient(circle at 80% 70%, rgba(0,0,0,0.05), transparent 55%)",
                    filter: "grayscale(1)",
                    opacity: isDragOver ? 0.95 : 0.75,
                  }}
                />

                <div className="fw-semibold text-dark" style={{ fontSize: "1.05rem" }}>
                  <i
                    className={"fa fa-upload me-2 " + (isDragOver ? "text-primary" : "text-muted")}
                    aria-hidden="true"
                  />
                  Drag a file here to upload your data
                </div>

                <div className="text-muted small mt-1">
                  Or click <span className="fw-semibold">Upload List</span> to choose a file.{" "}
                  <span className="ms-1">(.csv or .xlsx)</span>
                </div>

                {isDragOver && (
                  <div className="small mt-2 text-primary">
                    <i className="fa fa-arrow-down me-1" aria-hidden="true" />
                    Drop to start upload & validation
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "30%" }}>List Name</th>
                    <th style={{ width: "18%" }}>Date Created</th>
                    <th style={{ width: "18%" }}>Last Updated</th>
                    <th style={{ width: "14%" }}>Preview</th>
                    <th style={{ width: "20%" }}>Owner</th>
                    <th style={{ width: "4%" }} className="text-end"></th>
                  </tr>
                </thead>

                <tbody className="table-hover">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      onClick={() => onPreview(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPreview(r);
                        }
                      }}
                    >
                      <td className="fw-medium">
                        <span>{r.name}</span>
                        {r.isShared ? (
                          <span
                            className="badge text-white ms-2"
                            style={{ backgroundColor: "var(--theme-secondary)", letterSpacing: "0.02em" }}
                          >
                            Shared
                          </span>
                        ) : null}
                      </td>
                      <td className="text-muted">{r.createdAt}</td>
                      <td className="text-muted">{r.updatedAt}</td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0"
                          onClick={() => onPreview(r)}
                        >
                          Preview
                        </button>
                      </td>

                      <td className="text-muted">{r.owner}</td>
                      <td className="text-end" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-danger"
                          title="Delete list"
                          onClick={() => onDelete(r)}
                        >
                          <i className="fa fa-trash" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
