// components/auth/RegistrationSuccessForm.tsx
import React from "react";
import { Button, Form, FormGroup } from "reactstrap";

type RegistrationSuccessFormProps = {
  onLogin: () => void; // pass your handleClick here
};

const RegistrationSuccessForm: React.FC<RegistrationSuccessFormProps> = ({ onLogin }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <Form className="theme-form" onSubmit={handleSubmit}>
      <h3>Registration successful</h3>
      <p>You have successfully registered. Please log in to start using your account.</p>

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

export default RegistrationSuccessForm;
