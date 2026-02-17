import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { SettingPageTitle, SettingsCardTitle} from "../constants";
import CommonCardHeader from "../shared/ui/CommonCardHeader";
import { SettingsPageSubTitle } from "../utils/Pages";
import UserWorkSpaceSettings from "../features/settings/ui/settings"
import SettingsNav from "../features/settings/ui/SettingsNav";

const SettingsPage= () => {
  return (
    <>
      <Container fluid>
        <Row>
          <Col sm="12">
            <Card>
              <CommonCardHeader title={SettingPageTitle} span={SettingsPageSubTitle} tag />
              <CardBody>
                <SettingsNav />
                <h5 className="mb-3">{SettingsCardTitle}</h5>
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
