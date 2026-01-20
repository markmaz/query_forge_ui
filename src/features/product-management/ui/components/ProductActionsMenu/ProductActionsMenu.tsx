import "./ProductActionsMenu.css"
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

type Props = {
  productId: string;
  productStatus?: "Active" | "Inactive" | string | null;
  productGroupId: string | null;
  onAction: (action: "add_role" | "deactivate" | "restore" | "remove") => void;
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

const ProductActionsMenu: React.FC<Props> = ({ productStatus, onAction }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setStyle({
        top: r.bottom + window.scrollY,
        left: r.right - 200 + window.scrollX, // a tad wider now
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
      className="action-menu bg-white border rounded shadow-sm p-1"
      style={{ ...style, width: 200 }}
      role="menu"
      aria-labelledby="product-actions-btn"
    >
      {productStatus === "Inactive" ? (
        <button
          className="action-menu__item btn btn-sm w-100 text-start border-0 px-2 py-2"
          onClick={() => {
            onAction("restore");
            setOpen(false);
          }}
          role="menuitem"
        >
          <i className="fa fa-arrows-rotate me-2" />
          Restore Product
        </button>
      ) : (
        <>
        <button
        className="action-menu__item btn btn-sm w-100 text-start border-0 px-2 py-2"
        onClick={() => {
          onAction("add_role");
          setOpen(false);
        }}
        role="menuitem"
      >
        <i className="fa fa-user-plus me-2" />
        Add Role
      </button>
        <button
          className="action-menu__item btn btn-sm w-100 text-start border-0 px-2 py-2"
          onClick={() => {
            onAction("remove");
            setOpen(false);
          }}
          role="menuitem"
        >
          <i className="fa fa-eraser me-2" />
          Remove From Group
        </button>
        <button
          className="action-menu__item btn btn-sm w-100 text-start border-0 px-2 py-2"
          onClick={() => {
            onAction("deactivate");
            setOpen(false);
          }}
          role="menuitem"
        >
          <i className="fa fa-trash me-2" />
          Deactivate Product
        </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        id="product-actions-btn"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => setOpen((p) => !p)}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && ReactDOM.createPortal(menu, getPortalRoot())}
    </>
  );
};

export default ProductActionsMenu;
