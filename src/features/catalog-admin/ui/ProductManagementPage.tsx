import { Card, CardBody, Col, Container, Row } from "reactstrap";
import CommonCardHeader from "../../../shared/components/ExtendedCommonCardHeader";
import ProductTable from "./components/ProductTable";

const ProductManagementPage = () => {
  return (
    <>
      <Container fluid>
        <Row>
          <Col sm="12">
            <Card>
              <CommonCardHeader title="Product Groups"/>
              <CardBody>
                <ProductTable/>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default ProductManagementPage;
