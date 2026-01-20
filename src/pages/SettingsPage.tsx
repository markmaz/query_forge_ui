import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { Pages, SettingPageTitle, SettingsCardTitle} from "../constants";
import Breadcrumbs from "../shared/ui/breadcrumbs";
import CommonCardHeader from "../shared/ui/CommonCardHeader";
import { SettingsPageSubTitle } from "../utils/Pages";
import UserWorkSpaceSettings from "../features/settings/ui/settings"

const SettingsPage= () => {
  return (
    <>
      <Breadcrumbs mainTitle={SettingPageTitle} parent={Pages} />
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
