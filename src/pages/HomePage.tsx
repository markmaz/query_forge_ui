import { Container, Row } from "reactstrap";
import NewsCards from "../features/home/ui/NewsArticles";

const HomePage = () => {
  return (
    <>
      <Container fluid>
        <Row>
          <NewsCards/>
        </Row>
      </Container>
    </>
  );
};

export default HomePage;
