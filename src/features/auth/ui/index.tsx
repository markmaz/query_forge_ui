import { Col, Container, Row } from "reactstrap";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { dynamicImage } from "../../../utils";
import { routes } from "../../../app/routes/routes";
import { Image } from "../../../shared/ui/Image";

import SignInForm from "./SignInForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import OtpForm from "./OtpForm";
import InviteAcceptPage from "./InviteAcceptPage";
import RegistrationSuccessForm from "./RegistrationSuccessForm";
import ResetPasswordForm from "./ResetPasswordForm";
import ForgotPasswordRequestSuccess from "./ForgotPasswordRequestSuccess";

type AuthMode = "forgot" | "reset" | "otp" | "register" | "success" | "auth" | "forgot_success";

type ModeConfig = {
  cardClass: string;
  containerClass: string;
  render: () => ReactNode;
};

const Auth = () => {
  const { mode } = useParams();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(routes.Auth);
  };

  const MODE_CONFIG: Record<AuthMode, ModeConfig> = {
    forgot: {
      cardClass : "login-card login-dark",
      containerClass: "login-main",
      render: () => <ForgotPasswordForm />,
    },
    reset: {
      cardClass: "login-card login-dark",
      containerClass: "login-main reset-mode",
      render: () => <ResetPasswordForm />,
    },
    otp: {
      cardClass: "login-card login-dark otp-card",
      containerClass: "login-main otp-main",
      render: () => <OtpForm />,
    },
    register: {
      cardClass: "login-card login-dark",
      containerClass: "login-main",
      render: () => <InviteAcceptPage />,
    },
    success: {
      cardClass: "register-card login-dark",
      containerClass: "login-main success-mode",
      render: () => <RegistrationSuccessForm onLogin={handleClick} />,
    },
    auth: {
      cardClass: "login-card login-dark",
      containerClass: "login-main",
      render: () => <SignInForm />,
    },
    forgot_success: {
      cardClass: "register-card login-dark",
      containerClass: "register-main",
      render: () => <ForgotPasswordRequestSuccess />,
    },
  };

  const resolvedMode: AuthMode =
    (["forgot", "reset", "otp", "register", "success", "forgot_success"].includes(mode as string)
      ? (mode as AuthMode)
      : "auth");

  const { cardClass, containerClass, render } = MODE_CONFIG[resolvedMode];

  const content = (
    <Container fluid className="p-0">
      <Row className="m-0">
        <Col xs="12" className="p-0">
          <div className={cardClass}>
            <div>
              <div className={containerClass}>
                {render()}
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );

  return (
    <div className="qf-login-hero d-flex align-items-center justify-content-center">
      {content}
    </div>
  );
};

export default Auth;
