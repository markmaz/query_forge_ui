import { Col, Container, Row } from "reactstrap";
import { useAppVersion } from "../../shared/react-hooks/useAppVersion";
import { APP_VERSION } from "../../shared/meta/appVersion";

function buildVersionTooltip(payload: Record<string, unknown> | null): string {
  if (!payload) return "";

  const details: string[] = [];
  const build = typeof payload.build === "string" ? payload.build.trim() : "";
  const commit = typeof payload.commit === "string" ? payload.commit.trim() : "";

  if (build) details.push(`build ${build}`);
  if (commit) details.push(`commit ${commit}`);

  return details.join(" | ");
}

const Footer = () => {
  const { versionText, raw } = useAppVersion();
  const tooltipText = buildVersionTooltip(raw);

  return (
    <footer className="footer">
      <Container fluid>
        <Row>
          <Col md="6" className="p-0 footer-copyright">
            <p className="mb-0">
              Copyright {new Date().getFullYear()} ©{" "}
              <a href="https://www.query-forge.com">QueryForge LLC</a>
            </p>
            <p className="mb-0" title={tooltipText || undefined}>
              Version: {APP_VERSION}, API {versionText}
            </p>
          </Col>
          <Col md="6" className="p-0">
            <p className="mb-0"></p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
