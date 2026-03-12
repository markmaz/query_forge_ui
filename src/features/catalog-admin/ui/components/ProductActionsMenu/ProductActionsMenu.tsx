import "./ProductActionsMenu.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

type Props = {
  productId: string;
  productStatus?: "Active" | "Inactive" | string | null;
  productGroupId: string | null;
  onAction: (action: "add_role" | "deactivate" | "restore" | "remove") => void;
};

type ActionConfig = {
  id: "add_role" | "deactivate" | "restore" | "remove";
  label: string;
  iconClass: string;
};

const MENU_WIDTH = 200;

function portalRoot(): HTMLElement {
  const existing = document.getElementById("action-menu-portal");
  if (existing) return existing;

  const created = document.createElement("div");
  created.id = "action-menu-portal";
  document.body.appendChild(created);
  return created;
}

function anchoredMenuStyle(button: HTMLButtonElement): React.CSSProperties {
  const rect = button.getBoundingClientRect();
  return {
    position: "absolute",
    zIndex: 2000,
    top: rect.bottom + window.scrollY,
    left: rect.right - MENU_WIDTH + window.scrollX,
  };
}

function buildActions(productStatus?: Props["productStatus"]): ActionConfig[] {
  if (productStatus === "Inactive") {
    return [
      {
        id: "restore",
        label: "Restore Product",
        iconClass: "fa fa-arrows-rotate",
      },
    ];
  }

  return [
    { id: "add_role", label: "Add Role", iconClass: "fa fa-user-plus" },
    { id: "remove", label: "Remove From Group", iconClass: "fa fa-eraser" },
    { id: "deactivate", label: "Deactivate Product", iconClass: "fa fa-trash" },
  ];
}

const ProductActionsMenu: React.FC<Props> = ({ productStatus, onAction }) => {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    setStyle(anchoredMenuStyle(buttonRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const actions = useMemo(() => buildActions(productStatus), [productStatus]);

  const menu = (
    <div
      ref={menuRef}
      className="action-menu bg-white border rounded shadow-sm p-1"
      style={{ ...style, width: MENU_WIDTH }}
      role="menu"
      aria-labelledby="product-actions-btn"
    >
      {actions.map((action) => (
        <button
          key={action.id}
          className="action-menu__item btn btn-sm w-100 text-start border-0 px-2 py-2"
          role="menuitem"
          onClick={() => {
            onAction(action.id);
            setOpen(false);
          }}
        >
          <i className={`${action.iconClass} me-2`} />
          {action.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        id="product-actions-btn"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => setOpen((previous) => !previous)}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open ? ReactDOM.createPortal(menu, portalRoot()) : null}
    </>
  );
};

export default ProductActionsMenu;
