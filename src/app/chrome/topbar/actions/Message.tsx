import { Link } from "react-router-dom";
import { X } from "react-feather";

import { dynamicImage } from "../../../../src-utils";
import { routes } from "../../../navigation/routes";
import { CheckAll, MessageTitle } from "../../../../theme-constants";
import SvgIcon from "../../../../shared/components/SvgIcon";
import { messages } from "../Header";
import { Image } from "../../../../shared/components/Image";

const MESSAGE_BADGE_CLASS = "rounded-pill badge-danger";

const Message = () => {
  return (
    <li className="onhover-dropdown">
      <div className="message position-relative">
        <SvgIcon iconId="Message" />
        <span className={MESSAGE_BADGE_CLASS}></span>
      </div>
      <div className="onhover-show-div message-dropdown">
        <h6 className="f-18 mb-0 dropdown-title">{MessageTitle}</h6>
        <ul>
          {messages.map((item, index) => (
            <li key={index}>
              <div className="d-flex align-items-start">
                <div className="message-img bg-light-primary">
                  <Image src={dynamicImage(item.image)} />
                </div>
                <div className="flex-grow-1">
                  <h5 className="mb-1">
                    <Link to={routes.HomePage}>{item.title}</Link>
                  </h5>
                  <p>{item.text}</p>
                </div>
                <div className="notification-right">
                  <X />
                </div>
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
    </li>
  );
};
export default Message;
