import type { ComponentProps } from "react";

import NodeInspector from "./NodeInspector";

type NodeConfigDrawerProps = ComponentProps<typeof NodeInspector> & {
  open: boolean;
  onClose: () => void;
};

export default function NodeConfigDrawer({ open, onClose, ...inspectorProps }: NodeConfigDrawerProps) {
  if (!open) return null;

  const title = inspectorProps.node ? `Configure ${inspectorProps.node.label}` : "Configure action";

  return (
    <>
      <button type="button" className="ff-node-config-drawer-backdrop" aria-label="Close node configuration" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Action configuration" className="ff-node-config-drawer">
        <header className="ff-node-config-drawer-header">
          <div>
            <div className="ff-eyebrow">Action configuration</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ff-node-config-drawer-close" aria-label="Close action configuration" onClick={onClose}>
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="ff-node-config-drawer-body">
          <NodeInspector {...inspectorProps} />
        </div>
      </aside>
    </>
  );
}
