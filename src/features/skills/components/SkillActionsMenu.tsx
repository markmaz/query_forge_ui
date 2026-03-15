import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

import type { Skill, SkillLifecycleAction } from "../types";

type Props = {
  skill: Skill;
  onAction: (skill: Skill, action: SkillLifecycleAction) => void;
};

type ActionConfig = {
  id: SkillLifecycleAction;
  label: string;
  iconClass: string;
  destructive?: boolean;
};

const MENU_WIDTH = 220;

function portalRoot(): HTMLElement {
  const existing = document.getElementById("skill-action-menu-portal");
  if (existing) return existing;

  const created = document.createElement("div");
  created.id = "skill-action-menu-portal";
  document.body.appendChild(created);
  return created;
}

function anchoredMenuStyle(button: HTMLButtonElement): React.CSSProperties {
  const rect = button.getBoundingClientRect();
  return {
    position: "absolute",
    zIndex: 2400,
    top: rect.bottom + window.scrollY,
    left: rect.right - MENU_WIDTH + window.scrollX,
  };
}

function buildActions(skill: Skill): ActionConfig[] {
  const lifecycle: ActionConfig =
    skill.status === "active"
      ? { id: "pause", label: "Pause Skill", iconClass: "fa fa-pause" }
      : { id: "resume", label: "Resume Skill", iconClass: "fa fa-play" };

  return [
    { id: "edit", label: "Edit", iconClass: "fa fa-pen-to-square" },
    { id: "duplicate", label: "Duplicate", iconClass: "fa fa-copy" },
    lifecycle,
    { id: "view_runs", label: "View Runs", iconClass: "fa fa-clock-rotate-left" },
    { id: "delete", label: "Delete", iconClass: "fa fa-trash", destructive: true },
  ];
}

export default function SkillActionsMenu({ skill, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const actions = useMemo(() => buildActions(skill), [skill]);

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

    const onResizeOrScroll = () => {
      if (!buttonRef.current) return;
      setStyle(anchoredMenuStyle(buttonRef.current));
    };

    document.addEventListener("mousedown", onOutside);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open]);

  const menu = (
    <div
      ref={menuRef}
      className="skills-action-menu bg-white border rounded shadow-sm p-1"
      style={{ ...style, width: MENU_WIDTH }}
      role="menu"
      aria-label={`Actions for ${skill.name}`}
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          className={`skills-action-menu__item btn btn-sm w-100 text-start border-0 px-2 py-2 ${
            action.destructive ? "is-destructive" : ""
          }`}
          role="menuitem"
          onClick={() => {
            onAction(skill, action.id);
            setOpen(false);
          }}
        >
          <i className={`${action.iconClass} me-2`} aria-hidden="true" />
          {action.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((previous) => !previous);
        }}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open actions for ${skill.name}`}
      >
        <i className="fa fa-ellipsis" aria-hidden="true" />
      </button>
      {open ? ReactDOM.createPortal(menu, portalRoot()) : null}
    </>
  );
}
