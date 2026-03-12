import { Card, CardBody, Col, Container, Row } from "reactstrap";
import CommonCardHeader from "../shared/components/ExtendedCommonCardHeader";
import { UserManagementSubTitle } from "../src-utils/Pages";
import StatusFilter from "../features/access-admin/ui/UserFilter";
import UserTable from "../features/access-admin/ui/UserTable";

const UserManagementPage= () => {

  return (
    <>
      <Container fluid>
        <Row>
          <Col sm="12">
            <Card>
              <CommonCardHeader title="Users" span={UserManagementSubTitle}/>
              <CardBody>
                <StatusFilter/>
                <UserTable/>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default UserManagementPage;
