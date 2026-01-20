import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

type Props = {
  cohort_id: string;
  onAction: (action: "edit" | "delete" | "deploy" | "analyze") => void;
};

function getPortalRoot(): HTMLElement {
  let el = document.getElementById("action-menu-portal");
  if (!el) {
    el = document.createElement("div");
    el.id = "action-menu-portal";
    document.body.appendChild(el);
  }
  return el;
}

const CohortActionsMenu: React.FC<Props> = ({cohort_id, onAction }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setStyle({
        top: r.bottom + window.scrollY,
        left: r.right - 180 + window.scrollX,
        position: "absolute",
        zIndex: 2000,
      });
    }
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const menu = (
    <div
      ref={menuRef}
      className="bg-white border rounded shadow-sm p-1"
      style={{ ...style, width: 180 }}
    >
      <button
        className="w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2"
        onClick={() => {
          onAction("edit");
          setOpen(false);
        }}
      >
        <i className="fa-solid fa-edit me-2"/>
        Edit
      </button>
        <button
          className="w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2"
          onClick={() => {
            onAction("delete");
            setOpen(false);
          }}
        >
            <i className="fa-solid fa-trash-can me-2"/>
          Delete
        </button>

        <button
          className="w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2"
          onClick={() => {
            onAction("deploy");
            setOpen(false);
          }}
        >
            <i className="fa-solid fa-save me-2"/>
          Deploy
        </button>
        <button
          className="w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2"
          onClick={() => {
            onAction("analyze");
            setOpen(false);
          }}
        >
            <i className="fa-solid fa-magnifying-glass-chart me-2"/>Analyze
        </button>
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        className="btn btn-outline-secondary btn-sm"
        onClick={() => setOpen((p) => !p)}
        title="Actions"
      >
        ⋯
      </button>
      {open && ReactDOM.createPortal(menu, getPortalRoot())}
    </>
  );
};

export default CohortActionsMenu;
