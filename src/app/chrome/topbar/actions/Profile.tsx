import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LogIn } from "react-feather";
import { Link } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../../../../shared/runtime/hooks";
import { performLogout } from "../../../../features/identity/model/authSlice";
import { fetchUserProfile } from "../../../../features/access-admin/model/userSlice";
import { profileList } from "../Header";
import { routes } from "../../../navigation/routes";
import { LogOut } from "../../../../theme-constants";

const toDisplayText = (value: unknown): string => {
  const text = String(value ?? "").trim();
  return text;
};

const toTitleCaseWords = (value: string): string =>
  value
    .split(/[\s_:-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const Profile = () => {
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector((state) => state.user);
  const capabilities = useAppSelector((state) => state.user.capabilities || []);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLLIElement | null>(null);

  const roleLabel =
    toDisplayText(user?.role) ||
    (capabilities.includes("system:admin")
      ? "System Admin"
      : capabilities.some((capability) => capability.endsWith(":admin"))
        ? "Administrator"
        : capabilities.length > 0
          ? toTitleCaseWords(capabilities[0].replace(":", " "))
          : "Account");

  const fullName =
    [
      toDisplayText(user?.first_name),
      toDisplayText(user?.last_name),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    roleLabel ||
    toDisplayText(user?.display_name) ||
    toDisplayText(user?.user_name) ||
    toDisplayText(user?.email) ||
    (loading ? "Loading account..." : "Account");

  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const allowedProfileItems = profileList.filter((item) => !item.guard || item.guard(capabilities));

  return (
    <li
      ref={rootRef}
      className={`profile-nav onhover-dropdown p-0 m-0 ${menuOpen ? "is-open" : ""}`}
      onMouseEnter={() => setMenuOpen(true)}
      onMouseLeave={() => setMenuOpen(false)}
    >
      <div
        className="d-flex profile-media align-items-center"
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        onFocus={() => setMenuOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setMenuOpen((open) => !open);
          }
          if (event.key === "Escape") {
            setMenuOpen(false);
          }
        }}
      >
        <div className="flex-grow-1">
          <div className="profile-summary-row" title={fullName}>
            <span>{fullName}</span>
            {menuOpen ? (
              <ChevronDown className="profile-chevron" aria-hidden="true" />
            ) : (
              <ChevronRight className="profile-chevron" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
      <ul className="profile-dropdown onhover-show-div">
        {allowedProfileItems.map((item) => (
          <li key={item.id}>
            <Link to={item.link}>
              {item.icon}
              <span>{item.text}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link onClick={() => dispatch(performLogout())} to={routes.Auth}>
            <LogIn />
            <span>{LogOut}</span>
          </Link>
        </li>
      </ul>
    </li>
  );
};

export default Profile;
