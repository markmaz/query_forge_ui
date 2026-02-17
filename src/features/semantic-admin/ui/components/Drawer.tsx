import React from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Drawer({ open, title, onClose, children, footer }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="semantic-admin-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="semantic-admin-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="semantic-admin-drawer-header">
          <div className="fw-semibold">{title}</div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} aria-label="Close">
            <i className="fa fa-times" />
          </button>
        </div>
        <div className="semantic-admin-drawer-body">{children}</div>
        {footer ? <div className="semantic-admin-drawer-footer">{footer}</div> : null}
      </aside>
    </>
  );
}

export default Drawer;

