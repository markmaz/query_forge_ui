import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { SettingPageTitle, SettingsCardTitle} from "../constants";
import CommonCardHeader from "../shared/ui/CommonCardHeader";
import { SettingsPageSubTitle } from "../utils/Pages";
import UserWorkSpaceSettings from "../features/settings/ui/settings"

const SettingsPage= () => {
  return (
    <>
      <Container fluid>
        <Row>
          <Col sm="12">
            <Card>
              <CommonCardHeader title={SettingsCardTitle} span={SettingsPageSubTitle} tag />
              <CardBody>
                <UserWorkSpaceSettings/>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default SettingsPage;
