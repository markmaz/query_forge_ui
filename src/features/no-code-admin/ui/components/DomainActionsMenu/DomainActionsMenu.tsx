import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import "./DomainActionsMenu.css";

type DomainAction = "manage_tables" | "edit" | "delete";

interface Props {
  canEdit: boolean;
  onAction: (action: DomainAction) => void;
}

const DomainActionsMenu: React.FC<Props> = ({ canEdit, onAction }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + window.scrollY,
        left: rect.right - 180 + window.scrollX,
        position: "absolute",
        zIndex: 1050,
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [open]);

  const portalRoot = document.getElementById("action-menu-portal") ?? document.body;

  const menu = open && (
    <div
      ref={menuRef}
      className="action-menu bg-white border rounded shadow-sm p-1"
      style={{ ...menuStyle, width: 180 }}
    >
      <button
        className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
        disabled={!canEdit}
        onClick={() => {
          onAction("manage_tables");
          setOpen(false);
        }}
      >
        <i className="fa fa-table me-2" />
        Manage Tables
      </button>

      <button
        className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
        disabled={!canEdit}
        onClick={() => {
          onAction("edit");
          setOpen(false);
        }}
      >
        <i className="fa fa-pencil me-2" />
        Edit
      </button>

      <div className="dropdown-divider my-1" />

      <button
        className="action-menu__item w-100 text-start btn btn-sm bg-white text-danger border-0 px-2 py-2 hover-highlight"
        disabled={!canEdit}
        onClick={() => {
          onAction("delete");
          setOpen(false);
        }}
      >
        <i className="fa fa-trash me-2" />
        Delete
      </button>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        className="btn btn-light btn-sm"
        onClick={() => setOpen((p) => !p)}
        title={canEdit ? "Actions" : "No edit permission"}
      >
        ⋯
      </button>
      {open && ReactDOM.createPortal(menu, portalRoot)}
    </>
  );
};

export default DomainActionsMenu;