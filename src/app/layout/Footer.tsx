import { Col, Container, Row } from "reactstrap";
import { APP_VERSION } from "../../shared/config/appVersion";

const Footer = () => {

  return (
    <footer className="footer">
      <Container fluid>
        <Row>
          <Col md="6" className="p-0 footer-copyright">
            <p className="mb-0">Copyright 2025 © <a href="https://www.kytheralabs.com">Kythera Labs</a></p>
            <p>Version: {APP_VERSION}</p>
          </Col>
          <Col md="6" className="p-0">
            <p className="mb-0"></p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
