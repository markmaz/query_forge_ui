import { Container, Row } from "reactstrap";
import { Pages } from "../constants";
import Breadcrumbs from "../shared/ui/breadcrumbs";
import NewsCards from "../features/home/ui/NewsArticles";

const HomePage = () => {
  return (
    <>
      <Breadcrumbs mainTitle="Kythera WorkBoard" parent={Pages} />
      <Container fluid>
        <Row>
          <NewsCards/>
        </Row>
      </Container>
    </>
  );
};

export default HomePage;
