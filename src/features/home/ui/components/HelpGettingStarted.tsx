// src/features/query-forge/ui/components/home/HelpGettingStarted.tsx
import React from "react";

export type HelpLink = {
  id: string;
  title: string;
  description?: string;
};

export type HelpGettingStartedProps = {
  title?: string;
  links: HelpLink[];
  onClickLink: (id: string) => void;
  onHide?: () => void; // optional “don’t show again”
};

const HelpGettingStarted: React.FC<HelpGettingStartedProps> = ({
  title = "Getting started",
  links,
  onClickLink,
  onHide,
}) => {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body d-flex align-items-center justify-content-between">
        <div className="fw-semibold">{title}</div>
        {onHide ? (
          <button className="btn btn-link btn-sm text-decoration-none" type="button" onClick={onHide}>
            Hide
          </button>
        ) : null}
      </div>

      <div className="card-body">
        <div className="list-group">
          {links.map((l) => (
            <button
              key={l.id}
              className="list-group-item list-group-item-action"
              type="button"
              onClick={() => onClickLink(l.id)}
            >
              <div className="fw-semibold">{l.title}</div>
              {l.description ? <div className="small text-muted">{l.description}</div> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpGettingStarted;