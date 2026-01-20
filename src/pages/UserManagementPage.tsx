import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { Pages } from "../constants";
import Breadcrumbs from "../shared/ui/breadcrumbs";
import CommonCardHeader from "../shared/ui/ExtendedCommonCardHeader";
import { UserManagementSubTitle } from "../utils/Pages";
import StatusFilter from "../features/user-management/ui/UserFilter";
import UserTable from "../features/user-management/ui/UserTable";

const UserManagementPage= () => {

  return (
    <>
      <Breadcrumbs mainTitle="User Management" parent={Pages} />
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