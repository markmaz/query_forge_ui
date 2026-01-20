import React from "react";

type Item = { id: string; label: string };

type Props = {
  title: string;
  items: Item[];
  onSelect: (id: string) => void;
  selectedId?: string;
};

export const DrawerGroup: React.FC<Props> = ({ title, items, onSelect, selectedId }) => {
  return (
    <div className="mb-3">
      <div className="text-uppercase text-muted fw-semibold" style={{ fontSize: 11 }}>
        {title}
      </div>
      <div className="list-group list-group-flush">
        {items.map((it) => {
          const active = it.id === selectedId;
          return (
            <button
              key={it.id}
              type="button"
              className={"list-group-item list-group-item-action py-2 " + (active ? "active" : "")}
              onClick={() => onSelect(it.id)}
            >
              <div className="d-flex align-items-center justify-content-between">
                <span style={{ fontSize: 13 }}>{it.label}</span>
                <span className="opacity-75" aria-hidden>
                  →
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};