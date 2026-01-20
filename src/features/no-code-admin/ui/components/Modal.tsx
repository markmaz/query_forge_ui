import React from "react";

export function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  if (!props.open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        zIndex: 1000,
      }}
      onMouseDown={props.onClose}
    >
      <div
        style={{
          width: props.width ?? 760,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", padding: 14, borderBottom: "1px solid #eee" }}>
          <div style={{ fontWeight: 800 }}>{props.title}</div>
          <button
            onClick={props.onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14 }}>{props.children}</div>

        {props.footer ? <div style={{ padding: 14, borderTop: "1px solid #eee" }}>{props.footer}</div> : null}
      </div>
    </div>
  );
}