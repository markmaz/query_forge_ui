// components/auth/RegistrationSuccessForm.tsx
import React from "react";
import { Button, Label } from "reactstrap"; // or wherever yours come from
import { useNavigate } from "react-router-dom";


const ForgotPasswordRequestSuccess: React.FC = () => {
  const navigate = useNavigate();
  
  const handleClick = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/auth")
  };

  return (
    <form>
      <div className="register-main">
        <Label>
          If the email you entered matches the one we have on record you will receive an email to reset your password.
        </Label>
      </div>

      <div className="form-group mb-0">
        <div className="text-end mt-3">
          <Button color="primary" className="w-100" block type="submit" onClick={handleClick}>
            Log In
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ForgotPasswordRequestSuccess;
