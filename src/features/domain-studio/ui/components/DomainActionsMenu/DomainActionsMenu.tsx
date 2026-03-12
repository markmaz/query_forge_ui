import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import "./DomainActionsMenu.css";

type DomainAction = "manage_tables" | "edit" | "delete";

type Props = {
  canEdit: boolean;
  onAction: (action: DomainAction) => void;
};

const MENU_WIDTH = 180;

function resolvePortalRoot() {
  return document.getElementById("action-menu-portal") ?? document.body;
}

function menuPositionFor(button: HTMLButtonElement): React.CSSProperties {
  const rect = button.getBoundingClientRect();
  return {
    position: "absolute",
    zIndex: 1050,
    top: rect.bottom + window.scrollY,
    left: rect.right - MENU_WIDTH + window.scrollX,
  };
}

export default function DomainActionsMenu({ canEdit, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    setStyle(menuPositionFor(buttonRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  const menuItems = useMemo(
    () => [
      {
        id: "manage_tables" as const,
        iconClass: "fa fa-table",
        label: "Manage Tables",
        className: "text-dark",
      },
      {
        id: "edit" as const,
        iconClass: "fa fa-pencil",
        label: "Edit",
        className: "text-dark",
      },
      {
        id: "delete" as const,
        iconClass: "fa fa-trash",
        label: "Delete",
        className: "text-danger",
      },
    ],
    []
  );

  const menu = (
    <div
      ref={menuRef}
      className="action-menu bg-white border rounded shadow-sm p-1"
      style={{ ...style, width: MENU_WIDTH }}
    >
      {menuItems.map((item, index) => (
        <React.Fragment key={item.id}>
          {index === 2 ? <div className="dropdown-divider my-1" /> : null}
          <button
            className={`action-menu__item w-100 text-start btn btn-sm bg-white border-0 px-2 py-2 ${item.className}`}
            disabled={!canEdit}
            onClick={() => {
              onAction(item.id);
              setOpen(false);
            }}
          >
            <i className={`${item.iconClass} me-2`} />
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        className="btn btn-light btn-sm"
        onClick={() => setOpen((previous) => !previous)}
        title={canEdit ? "Actions" : "No edit permission"}
      >
        ⋯
      </button>
      {open ? ReactDOM.createPortal(menu, resolvePortalRoot()) : null}
    </>
  );
}
