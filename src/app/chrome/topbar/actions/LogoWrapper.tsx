import { Link } from "react-router-dom";
import { Col } from "reactstrap";
import { routes } from "../../../navigation/routes";
import { dynamicImage } from "../../../../src-utils";
import { Image } from "../../../../shared/components/Image";

const LOGO_PATH = "logo/kythera-logo.jpg";

const LogoWrapper = () => {
  const logoSrc = dynamicImage(LOGO_PATH);

  return (
    <Col className="header-logo-wrapper col-auto p-0">
      <div className="logo-wrapper">
        <Link to={routes.HomePage}>
          <Image className="img-fluid for-light" src={logoSrc} alt="" />
          <Image className="img-fluid for-dark" src={logoSrc} alt="" />
        </Link>
      </div>
    </Col>
  );
};
export default LogoWrapper;
