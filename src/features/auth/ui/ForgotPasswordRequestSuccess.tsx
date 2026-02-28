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
        If an account exists for that email, a reset link has been sent.
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
