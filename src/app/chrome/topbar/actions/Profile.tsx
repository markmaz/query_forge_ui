import { useEffect } from "react";
import { LogIn } from "react-feather";
import { Link } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../../../../shared/runtime/hooks";
import { performLogout } from "../../../../features/identity/model/authSlice";
import { fetchUserProfile } from "../../../../features/access-admin/model/userSlice";
import { profileList } from "../Header";
import { routes } from "../../../navigation/routes";
import { LogOut } from "../../../../theme-constants";
import SvgIcon from "../../../../shared/components/SvgIcon";

const Profile = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.user);
  const capabilities = useAppSelector((state) => state.user.capabilities || []);
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || "Loading...";

  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  const allowedProfileItems = profileList.filter((item) => !item.guard || item.guard(capabilities));

  return (
    <li className="profile-nav onhover-dropdown p-0 m-0">
      <div className="d-flex profile-media align-items-center">
        <div className="flex-grow-1">
          <span>{fullName}</span>
          <p className="mb-0">
            {user?.role || ""}
            <SvgIcon iconId="header-arrow-down" />
          </p>
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
