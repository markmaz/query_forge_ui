import React from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 16,
  zIndex: 1000,
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 760,
}: ModalProps) {
  if (!open) return null;

  return (
    <div style={backdropStyle} onMouseDown={onClose}>
      <section
        style={{
          width,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 14,
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div style={{ padding: 14 }}>{children}</div>

        {footer ? <footer style={{ padding: 14, borderTop: "1px solid #eee" }}>{footer}</footer> : null}
      </section>
    </div>
  );
}
