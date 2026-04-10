import type { ReactNode } from "react";

type PlannerPolicyDrawerProps = {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
};

export function PlannerPolicyDrawer({
  title,
  onClose,
  footer,
  children,
}: PlannerPolicyDrawerProps) {
  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onClose} />
      <aside className="sa-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sa-drawer-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-sm btn-light" aria-label="Close planner policy drawer" onClick={onClose}>
            <i className="fa fa-times" />
          </button>
        </div>
        <div className="sa-drawer-body">{children}</div>
        <div className="sa-drawer-footer">{footer}</div>
      </aside>
    </>
  );
}
