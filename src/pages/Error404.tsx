import { Link, useNavigate } from "react-router-dom";
import { routes } from "../app/routes/routes";

const Error404 = () => {
  const navigate = useNavigate();

  return (
    <div className="qf-login-hero d-flex align-items-center justify-content-center">
      <div className="login-card login-dark">
        <div>
          <div className="d-flex flex-column align-items-center">
            <div className="login-main mt-3">
              <div className="theme-form text-center">
                <h3>Page not found</h3>
                <p>
                  {"The page you are looking for might have been removed, renamed, or is temporarily unavailable."}
                </p>
                <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                  <Link to={routes.HomePage} className="btn btn-primary">
                    {"Go to Home"}
                  </Link>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
                    {"Go Back"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Error404;
