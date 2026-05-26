// src/features/query-forge/ui/components/home/HelpGettingStarted.tsx
import React from "react";

export type HelpLink = {
  id: string;
  title: string;
  description?: string;
  tag?: string;
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
        <div className="row g-2">
          {links.map((l) => (
            <div key={l.id} className="col-12 col-md-6 col-xl-12">
              <button
                className="btn btn-light border w-100 h-100 text-start p-3"
                type="button"
                onClick={() => onClickLink(l.id)}
              >
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <div className="fw-semibold">{l.title}</div>
                  {l.tag ? <span className="badge text-bg-light border">{l.tag}</span> : null}
                </div>
                {l.description ? <div className="small text-muted mt-1">{l.description}</div> : null}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpGettingStarted;
