// components/auth/RegistrationSuccessForm.tsx
import React from "react";
import { Button, Label } from "reactstrap"; // or wherever yours come from

type RegistrationSuccessFormProps = {
  onLogin: () => void; // pass your handleClick here
};

const RegistrationSuccessForm: React.FC<RegistrationSuccessFormProps> = ({ onLogin }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="register-main">
        <Label>
          You have successfully registered. Please log in to start using your account.
        </Label>
      </div>

      <div className="form-group mb-0">
        <div className="text-end mt-3">
          <Button color="primary" className="w-100" block type="submit">
            Log In
          </Button>
        </div>
      </div>
    </form>
  );
};

export default RegistrationSuccessForm;
