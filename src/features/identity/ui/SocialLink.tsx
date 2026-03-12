import { Facebook, Linkedin, Twitter } from "react-feather";
import { Link } from "react-router-dom";
import { FacebookLink, LinkedIn, TwitterLink } from "../../../theme-constants";

const SOCIAL_LINKS = [
  { url: "https://www.linkedin.com/login", Icon: Linkedin, label: LinkedIn },
  { url: "https://twitter.com/login?lang=en", Icon: Twitter, label: TwitterLink },
  { url: "https://www.facebook.com/", Icon: Facebook, label: FacebookLink },
] as const;

// Social media links for login page
const SocialLink = () => {
  return (
    <div className="social mt-4">
      <div className="btn-showcase">
        {SOCIAL_LINKS.map(({ url, Icon, label }) => (
          <Link key={url} to={url} className="btn btn-light" target="_blank">
            <Icon /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
};
export default SocialLink;
