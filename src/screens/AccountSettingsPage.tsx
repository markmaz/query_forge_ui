import { Card, CardBody, Col, Container, Row } from "reactstrap";
import CommonCardHeader from "../shared/components/CommonCardHeader";
import SettingsNav from "../features/preferences/ui/SettingsNav";
import AccountSettingsPanel from "../features/preferences/ui/AccountSettingsPanel";

const AccountSettingsPage = () => {
  return (
    <Container fluid>
      <Row>
        <Col sm="12">
          <Card>
            <CommonCardHeader title="Account Settings" span={[{ text: "Manage your profile, security, and permissions." }]} tag />
            <CardBody>
              <SettingsNav />
              <AccountSettingsPanel />
            </CardBody>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AccountSettingsPage;
