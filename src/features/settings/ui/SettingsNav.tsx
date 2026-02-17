import { NavLink } from "react-router-dom";
import { routes } from "../../../app/routes/routes";
import "./settings.css";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `btn btn-sm settings-nav-link ${isActive ? "btn-primary" : "btn-outline-secondary"}`;

const SettingsNav = () => {
  return (
    <div className="d-flex flex-wrap gap-2 mb-4 settings-nav" role="tablist" aria-label="Settings sections">
      <NavLink className={navLinkClass} to={routes.SettingsAccountView}>
        Account
      </NavLink>
      <NavLink className={navLinkClass} to={routes.SettingsView} end>
        Workspace
      </NavLink>
    </div>
  );
};

export default SettingsNav;
