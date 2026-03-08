import { Button } from "reactstrap";
import { Link } from "react-router-dom";
import { dynamicImage } from "../../../../src-utils";
import { CheckAll, NotificationTitle } from "../../../../theme-constants";
import { notifications } from "../Header";
import { routes } from "../../../navigation/routes";
import SvgIcon from "../../../../shared/components/SvgIcon";
import { Image } from "../../../../shared/components/Image";

const renderActionButton = (label: string, color: "primary" | "secondary") => (
  <Button color={color} className="btn-pill">
    {label}
  </Button>
);

const Notification = () => {
  return (
    <li className="onhover-dropdown">
      <div className="notification-box">
        <SvgIcon iconId="Bell" />
      </div>
      <div className="onhover-show-div notification-dropdown">
        <h6 className="f-18 mb-0 dropdown-title">{NotificationTitle} </h6>
        <div className="notification-card">
          <ul>
            {notifications.map((item) => (
              <li key={item.id}>
                <div className="user-notification">
                  <div>
                    <Image src={dynamicImage(item.avatar)} alt="avatar" />
                  </div>
                  <div className="user-description">
                    <Link to={routes.HomePage}>
                      <h4>{item.text}</h4>
                    </Link>
                    <span>{item.time}</span>
                  </div>
                </div>
                <div className="notification-btn">
                  {renderActionButton("Accpet", "primary")}
                  {renderActionButton("Decline", "secondary")}
                </div>
                <div className="show-btn">
                  <Link to={routes.HomePage}>
                    <span>Show</span>
                  </Link>
                </div>
              </li>
            ))}
            <li>
              <Link className="f-w-700" to={routes.HomePage}>
                {CheckAll}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </li>
  );
};

export default Notification;
