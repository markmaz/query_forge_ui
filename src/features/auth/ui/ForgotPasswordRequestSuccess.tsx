import React from "react";
import { Button, Form, FormGroup } from "reactstrap";
import { useNavigate } from "react-router-dom";


const ForgotPasswordRequestSuccess: React.FC = () => {
  const navigate = useNavigate();
  
  const handleClick = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/auth")
  };

  return (
    <Form className="theme-form" onSubmit={handleClick}>
      <h3>Check your email</h3>
      <p>
        If the email you entered matches the one we have on record you will receive
        an email to reset your password.
      </p>

      <FormGroup className="mb-0">
        <div className="text-end mt-3">
          <Button color="primary" className="w-100" block type="submit">
            Log In
          </Button>
        </div>
      </FormGroup>
    </Form>
  );
};

export default ForgotPasswordRequestSuccess;
