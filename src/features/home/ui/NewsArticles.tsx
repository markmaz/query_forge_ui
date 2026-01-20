import { useEffect, useState } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, CardText } from "reactstrap";
import { fetchNewsArticles } from "../../../shared/api/news";
import { logout } from "../../auth/model/authSlice";

interface Article {
  link: string;
  title: string;
  summary: string;
  date: string;
  image: string;
}

const NewsCards = () => {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const data = await fetchNewsArticles(3);
        if(data){
            setArticles(data);
        }else{
            logout()
        }
        
      } catch (error) {
        console.error("Failed to fetch news articles:", error);
      }
    };

    fetchArticles();
  }, []);

  return (
    <Container className="my-4">
      <Row>
        {articles.map((article, index) => (
          <Col sm="12" md="4" key={index} className="mb-3">
            <Card
              className="h-100 rounded-3 shadow-sm"
              style={{ cursor: "pointer" }}
              tag="a"
              href={article.link} // Making the whole card a link
            >
              {/* Image at the top */}
              <img
                src={article.image}
                alt={article.title}
                className="card-img-top rounded-top"
                style={{ objectFit: "cover", height: "200px" }} // Optional: Adjust image size
              />
              <CardBody>
                <CardTitle tag="h5">{article.title}</CardTitle>
                <CardText>{article.summary}</CardText>
                <CardText className="text-muted" style={{ fontSize: "0.9rem" }}>
                  {article.date}
                </CardText>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default NewsCards;
