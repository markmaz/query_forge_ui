import { Container, Row, Col, Card, CardBody } from "reactstrap";
import CohortManagementTable from "./components/CohortManagmentTable"

const CohortManagementPage: React.FC = () => {
    return (
    <>
      <Container fluid>
        <Row>
          <Col sm="12">
            <Card>
              <CardBody>
                <CohortManagementTable/>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
    )
}
export default CohortManagementPage;
