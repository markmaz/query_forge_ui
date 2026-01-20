import Breadcrumbs from "../../../shared/ui/breadcrumbs";
import { Container, Row, Col, Card, CardBody } from "reactstrap";
import CommonCardHeader from "../../../shared/ui/CommonCardHeader";
import CohortManagementTable from "./components/CohortManagmentTable"
import { Pages } from "../../../constants";

const CohortManagementPage: React.FC = () => {
    return (
    <>
      <Breadcrumbs mainTitle="My Cohorts" parent={Pages} />
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
;