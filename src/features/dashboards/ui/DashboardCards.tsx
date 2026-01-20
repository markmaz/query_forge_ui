import {
    Container,
    Row,
    Col,
    Card,
    CardBody,
    CardTitle,
    CardText,
    CardHeader,
  } from "reactstrap";
  import { dynamicImage } from "../../../utils";
  
  const dashboardData = [
    {
      image: "dashboards/surgical_encounters.png",
      title: "Surgical Events",
      text: "Track and analyze surgical performance across facilities.",
      link: "/dashboards/surgical-events",
    },
    {
      image: "dashboards/surgical_encounters.png",
      title: "ER Flow",
      text: "Monitor ER visit trends, wait times, and triage outcomes.",
      link: "/dashboards/er-flow",
    },
    {
      image: "dashboards/surgical_encounters.png",
      title: "Patient Outcomes",
      text: "Understand discharge status and recovery success rates.",
      link: "/dashboards/patient-outcomes",
    },
  ];
  
  const DashboardCards = () => {
    return (
      <Container className="my-4">
        <Card className="shadow-sm rounded-3">
          <CardHeader
            className="bg-primary text-white fw-bold w-100 m-0"
            style={{ fontSize: "1.25rem" }}
          >
            Dashboards
          </CardHeader>
  
          <Row className="justify-content-center g-4 px-3 py-4">
            {dashboardData.map((item, index) => (
              <Col key={index} sm="12" md="4">
                <Card
                  className="h-100 rounded-3 shadow-sm card-hover"
                  style={{ cursor: "pointer" }}
                  tag="a"
                  href={item.link}
                >
                  <img
                    src={dynamicImage(item.image)}
                    alt={item.title}
                    className="card-img-top rounded-top"
                    style={{ objectFit: "cover", height: "200px" }}
                  />
                  <CardBody>
                    <CardTitle tag="h5">{item.title}</CardTitle>
                    <CardText>{item.text}</CardText>
                  </CardBody>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Container>
    );
  };
  
  export default DashboardCards;
  