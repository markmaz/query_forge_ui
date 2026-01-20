import React, { useCallback, useState } from "react";

type Props = {
  minHeight?: number;

  iconClass?: string;          // e.g. "fa-eye", "fa-magic-wand-sparkles"
  title: React.ReactNode;      // headline
  subtitle?: React.ReactNode;  // helper copy

  ctaLabel?: React.ReactNode;  // optional bold CTA label inside subtitle
  onClick?: () => void;

  // Optional drag/drop. If you don't pass onDropFile, it still renders but DnD is inert.
  acceptText?: string;         // e.g. "(.csv or .xlsx)"
  onDropFile?: (file: File) => void;
};

export const EmptySectionState: React.FC<Props> = ({
  minHeight = 200,
  iconClass = "fa-circle-info",
  title,
  subtitle,
  ctaLabel,
  acceptText,
  onClick,
  onDropFile,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onDropFile) return;
      e.preventDefault();
      setIsDragOver(true);
    },
    [onDropFile]
  );

  const onDragLeave = useCallback(() => {
    if (!onDropFile) return;
    setIsDragOver(false);
  }, [onDropFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!onDropFile) return;
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onDropFile(f);
    },
    [onDropFile]
  );

  const clickable = Boolean(onClick);

  return (
    <div
      className="rounded p-4"
      style={{
        minHeight,
        cursor: clickable ? "pointer" : "default",
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
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => (clickable && e.key === "Enter" ? onClick?.() : null)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={typeof title === "string" ? title : "Empty state"}
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
            className={
              "fa " +
              iconClass +
              " me-2 " +
              (isDragOver ? "text-primary" : "text-muted")
            }
            aria-hidden="true"
          />
          {title}
        </div>

        {subtitle ? (
          <div className="text-muted small mt-1">
            {subtitle}{" "}
            {ctaLabel ? <span className="fw-semibold">{ctaLabel}</span> : null}{" "}
            {acceptText ? <span className="ms-1">{acceptText}</span> : null}
          </div>
        ) : null}

        {isDragOver ? (
          <div className="small mt-2 text-primary">
            <i className="fa fa-arrow-down me-1" aria-hidden="true" />
            Drop to continue
          </div>
        ) : null}
      </div>
    </div>
  );
};