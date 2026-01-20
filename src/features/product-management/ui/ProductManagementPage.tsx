import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { Pages} from "../../../constants";
import Breadcrumbs from "../../../shared/ui/breadcrumbs";
import CommonCardHeader from "../../../shared/ui/ExtendedCommonCardHeader";
import ProductTable from "./components/ProductTable";

const ProductManagementPage = () => {
  return (
    <>
      <Breadcrumbs mainTitle="Product Management" parent={Pages} />
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