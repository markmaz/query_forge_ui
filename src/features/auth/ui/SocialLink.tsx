import { Facebook, Linkedin, Twitter } from "react-feather";
import { Link } from "react-router-dom";
import { FacebookLink, LinkedIn, TwitterLink } from "../../../constants";

// Social media links for login page
const SocialLink = () => {
  return (
    <div className="social mt-4">
      <div className="btn-showcase">
        <Link to="https://www.linkedin.com/login" className="btn btn-light" target="_blank">
          <Linkedin /> {LinkedIn}
        </Link>
        <Link to="https://twitter.com/login?lang=en" className="btn btn-light" target="_blank">
          <Twitter /> {TwitterLink}
        </Link>
        <Link to="https://www.facebook.com/" className="btn btn-light" target="_blank">
          <Facebook /> {FacebookLink}
        </Link>
      </div>
    </div>
  );
};
export default SocialLink;
