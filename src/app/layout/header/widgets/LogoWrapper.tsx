import { Link } from "react-router-dom";
import { Col } from "reactstrap";
import { routes } from "../../../routes/routes";
import { dynamicImage } from "../../../../utils";
import { Image } from "../../../../shared/ui/Image";

const LogoWrapper = () => {

  return (
    <Col className="header-logo-wrapper col-auto p-0">
      <div className="logo-wrapper">
        <Link to={routes.HomePage}>
          <Image className="img-fluid for-light" src={dynamicImage(`logo/kythera-logo.jpg`)} alt="" />
          <Image className="img-fluid for-dark" src={dynamicImage(`logo/kythera-logo.jpg`)} alt="" />
        </Link>
      </div>
    </Col>
  );
};
export default LogoWrapper;
