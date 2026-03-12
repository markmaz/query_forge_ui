import { Col } from "reactstrap";
import { dynamicImage } from "../../src-utils";
import { Image } from "./Image";

type SearchNotFoundProps = { word: string };

const SearchNotFoundClass: React.FC<SearchNotFoundProps> = ({ word }) => {
  const message = `Sorry, Not Found Any ${word}`;

  return (
    <Col sm="12">
      <div>
        <div className="text-center p-5">
          <Image className="img-100 mb-4" src={dynamicImage(`other-images/sad.gif`)} alt="" />
          <p>{message}</p>
        </div>
      </div>
    </Col>
  );
};

export default SearchNotFoundClass;
