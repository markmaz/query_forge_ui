import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import "./UserActionsMenu.css";

interface UserActionsMenuProps {
  userId: string;
  userStatus: string; // "Active" | "Invited" | "Inactive" | "Deactivated"
  onAction: (userId: string, action: string) => void;
}

const UserActionsMenu: React.FC<UserActionsMenuProps> = ({ userId, userStatus, onAction }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const isInvited = userStatus === "Invited";
  const isInactive = userStatus === "Inactive" || userStatus === "Deactivated";
  const isActive = userStatus === "Active";

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + window.scrollY,
        left: rect.right - 180 + window.scrollX, // align right edge to 180px menu
        position: "absolute",
        zIndex: 1050,
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Use 'click' so menu item onClick fires before we close
    const handleDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [open]);

  const portalRoot = document.getElementById("action-menu-portal") ?? document.body;

  const menu = open && (
    <div
      ref={menuRef}
      className="action-menu bg-white border rounded shadow-sm p-1"
      style={{ ...menuStyle, width: 180 }}
    >
      {/* Invited */}
      {isInvited && (
        <>
          <button
            className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
            onClick={() => { onAction(userId, "resend_invite"); setOpen(false); }}
          >
            <i className="fa fa-paper-plane me-2"/>
            Resend Invite
          </button>
          <button
            className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
            onClick={() => { onAction(userId, "manage_access"); setOpen(false); }}
          >
            <i className="fa fa-wrench me-2"/>
            Manage Product Access
          </button>
          <button
            className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
            onClick={() => { onAction(userId, "deactivate"); setOpen(false); }}
          >
            <i className="fa fa-trash me-2"/>
            Deactivate
          </button>
        </>
      )}

      {/* Inactive/Deactivated */}
      {isInactive && (
        <button
          className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
          onClick={() => { onAction(userId, "restore"); setOpen(false); }}
        >
          <i className="fa fa-recycle me-2"/>
          Restore
        </button>
      )}

      {/* Active */}
      {isActive && (
        <>
          <button
            className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
            onClick={() => { onAction(userId, "reset_password"); setOpen(false); }}
          >
            <i className="fa fa-unlock me-2"/>
            Reset Password
          </button>
          <button
            className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
            onClick={() => { onAction(userId, "manage_access"); setOpen(false); }}
          >
            <i className="fa fa-wrench me-2"/>
            Manage Product Access
          </button>
          <button
            className="action-menu__item w-100 text-start btn btn-sm bg-white text-dark border-0 px-2 py-2 hover-highlight"
            onClick={() => { onAction(userId, "deactivate"); setOpen(false); }}
          >
            <i className="fa fa-trash me-2"/>
            Deactivate
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        className="btn btn-light btn-sm"
        onClick={() => setOpen(prev => !prev)}
      >
        ⋯
      </button>
      {open && ReactDOM.createPortal(menu, portalRoot)}
    </>
  );
};

export default UserActionsMenu;
