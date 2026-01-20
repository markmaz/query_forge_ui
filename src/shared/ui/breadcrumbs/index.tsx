import { Link } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, Col, Container, Row } from "reactstrap";
import { routes } from "../../../app/routes/routes";
import { BreadcrumbsProps } from "../../../entities/CoreComponents";
import SvgIcon from "../SvgIcon";

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ mainTitle, parent }) => {
  return (
    <Container fluid>
      <div className="page-title">
        <Row>
          <Col xl="4" sm="7" className="box-col-3">
            <h3>{mainTitle}</h3>
          </Col>
          <Col xs="5" className="d-none d-xl-block">
          </Col>
          <Col xl="3" sm="5" className="box-col-4">
            <Breadcrumb>
              <BreadcrumbItem>
                <Link to={routes.HomePage}>
                  <SvgIcon className="stroke-icon" iconId="stroke-home" />
                </Link>
              </BreadcrumbItem>
              <BreadcrumbItem>{parent}</BreadcrumbItem>
              <BreadcrumbItem active>{mainTitle}</BreadcrumbItem>
            </Breadcrumb>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default Breadcrumbs;
