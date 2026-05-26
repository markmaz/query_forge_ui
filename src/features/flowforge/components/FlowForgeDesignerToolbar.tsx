import type { ReactNode } from "react";

import "../../query-forge/ui/styles/queryForgeHero.css";

interface FlowForgeDesignerToolbarProps {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}

export default function FlowForgeDesignerToolbar({
  actions,
  title,
  description,
}: FlowForgeDesignerToolbarProps) {
  return (
    <header className="qf-hero mb-3 ncqv2-header-toolbar">
      <div className="qf-hero-main">
        <h1 className="qf-hero-title">{title}</h1>
        <p className="qf-hero-subtitle mb-0">{description}</p>
      </div>
      {actions ? <div className="qf-hero-actions">{actions}</div> : null}
    </header>
  );
}
