import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { SettingPageTitle, SettingsCardTitle} from "../theme-constants";
import CommonCardHeader from "../shared/components/CommonCardHeader";
import { SettingsPageSubTitle } from "../src-utils/Pages";
import UserWorkSpaceSettings from "../features/preferences/ui/settings"
import SettingsNav from "../features/preferences/ui/SettingsNav";

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
