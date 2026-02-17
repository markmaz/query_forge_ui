import * as yup from "yup";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Form, FormGroup, Label } from "reactstrap";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { resetPassword, validateResetToken } from "../../../shared/services/auth";
const Password = "Password";
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{15,}$/;

const getSchema = (isPasswordVisible: boolean) =>
  yup.object().shape({
    password: yup
      .string()
      .min(15, "Password must be at least 15 characters long")
      .matches(
        passwordRegex,
        "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character"
      )
      .required("Password is required"),
    confirmPassword: yup.string().when("password", (password, schema) => {
      return !isPasswordVisible
        ? schema
            .required("Please confirm your password")
            .oneOf([yup.ref("password")], "Passwords must match")
        : schema.notRequired();
    }),
  });

const ResetPasswordForm = () => {
  const query = new URLSearchParams(useLocation().search);
  const token = query.get("token");
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const toggle = () => setPasswordVisible(!isPasswordVisible);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

   useEffect(() => {
    const fetchToken = async () => {
        if (!token){
          toast.error("Failed to validate token. Please try to reset your password again.");
          return;
        }

        try {
            await validateResetToken(token);
            } catch {
                toast.error("Failed to validate token. Please try to reset your password again.");
            }
        };

        fetchToken();
    }, [token]);

type RegistrationFormValues = {
  password: string;
  confirmPassword?: string;
};

const {
  register,
  handleSubmit,
  setError,
  clearErrors,
  formState: { errors },
} = useForm<RegistrationFormValues>({
  resolver: yupResolver(getSchema(isPasswordVisible)),
  defaultValues: {
    password: "",
    confirmPassword: "",
  },
});

const passwordRegister = register("password");

const onSubmit = async (data: RegistrationFormValues) => {
  try{
    setSubmitError(null);
    await resetPassword(data.password);
    toast.success("Your password has been reset - please log in.");
    navigate("/auth")
  } catch(error: any){
    const message = error?.message ?? "Password was not updated. Please contact the support desk.";
    setSubmitError(message);
    setError("password", { type: "server", message });
  }
  
};

  return (
    <Form className="theme-form" onSubmit={handleSubmit(onSubmit)}>
      <h3>Password Reset</h3>
      {submitError ? (
        <div className="alert alert-danger" role="alert" aria-live="polite">
          {submitError}
        </div>
      ) : null}
      <p>{"Please enter your new password"}</p>

      <FormGroup>
        <Label className="col-form-label">{Password}</Label>
        <div className="form-input position-relative">
          <input
            className="form-control"
            type={isPasswordVisible ? "text" : "password"}
            {...passwordRegister}
            onChange={(e) => {
              passwordRegister.onChange(e);
              if (submitError) setSubmitError(null);
              clearErrors("password");
            }}
          />
          <div className="show-hide" onClick={toggle}>
            <span className={!isPasswordVisible ? "show" : ""}></span>
          </div>
        </div>
        {errors.password && (
          <p className="text-danger mt-1">{errors.password.message}</p>
        )}
      </FormGroup>

      {!isPasswordVisible && (
        <FormGroup>
          <Label className="col-form-label">Confirm Password</Label>
          <input
            className="form-control"
            type="password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-danger mt-1">{errors.confirmPassword.message}</p>
          )}
        </FormGroup>
      )}

      <div className="form-group mb-0">
        <div className="text-end mt-3">
          <Button color="primary" className="w-100" block>
            Register
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default ResetPasswordForm;
