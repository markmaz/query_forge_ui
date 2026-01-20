import { Link } from "react-router-dom";
import { dynamicImage } from "../../../../utils";
import { routes } from "../../../routes/routes";
import { Image } from "../../../../shared/ui/Image";

const LogoWrapper = () => {

  return (
    <>
      <div className="logo-wrapper">
        <Link to={routes.HomePage}>
          <Image className="img-fluid for-light" src={dynamicImage(`logo/kythera-logo.jpg`)} alt="" />
          <Image className="img-fluid for-dark" src={dynamicImage(`logo/kythera-logo.jpg`)} alt="" />
        </Link>
      </div>
      <div className="logo-icon-wrapper">
        <Link to={routes.HomePage}>
          <Image className="img-fluid" src={dynamicImage(`logo/logo-icon.png`)} alt="" />
        </Link>
      </div>
    </>
  );
};

export default LogoWrapper;
