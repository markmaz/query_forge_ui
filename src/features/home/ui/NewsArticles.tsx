import { useEffect, useState } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, CardText } from "reactstrap";
import { fetchNewsArticles } from "../../../shared/services/news";
import { useAppDispatch } from "../../../shared/lib/hooks";
import { performLogout } from "../../auth/model/authSlice";

interface Article {
  link: string;
  title: string;
  summary: string;
  date: string;
  image: string;
}

const NewsCards = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const data = await fetchNewsArticles(3);
        if(data){
            setArticles(data);
        }else{
            dispatch(performLogout());
        }
        
      } catch (error) {
        console.error("Failed to fetch news articles:", error);
      }
    };

    fetchArticles();
  }, []);

  return (
    <Container className="my-4">
    </Container>
  );
};

export default NewsCards;
