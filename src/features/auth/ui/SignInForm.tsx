import * as yup from "yup";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, Form, FormGroup, Label } from "reactstrap";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm, Controller } from "react-hook-form";
import SmartInput from "../../../shared/ui/SmartInput";

import {
  EmailAddress,
  ForgotPassword,
  Href,
  Password,
  SignIn,
  SignInAccount,
} from "../../../constants";
import { routes } from "../../../app/routes/routes";
import { useAppDispatch } from "../../../shared/lib/hooks";
import { emitAuthTelemetry } from "../../../shared/lib/authTelemetry";
import { fetchAuthToken, type AuthThunkError } from "../model/authSlice";

// Validation schema
const schema = yup.object().shape({
  username: yup.string().required("Username is required"),
  password: yup
    .string()
    .required("Password is required"),
});

const SignInForm = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const toggle = () => setPasswordVisible(!isPasswordVisible);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      username: "Your email address",
      password: "",
    },
  });

  const getErrorMessage = (error: unknown) => {
    const fallback = "Unable to sign in. Please try again.";
    const genericAuthFailure = "Invalid username or password.";
    if (!error || typeof error !== "object") return fallback;
    const maybeAuthError = error as Partial<AuthThunkError> & { status?: number };
    if (maybeAuthError.code === "invalid_username_or_password" || maybeAuthError.status === 401) {
      return genericAuthFailure;
    }
    return maybeAuthError.message ?? fallback;
  };

  const getErrorStatusCode = (error: unknown): number | null => {
    if (!error || typeof error !== "object") return null;
    const maybeAuthError = error as Partial<AuthThunkError> & { status?: number };
    if (typeof maybeAuthError.status === "number") return maybeAuthError.status;
    if (maybeAuthError.code === "invalid_username_or_password") return 401;
    if (maybeAuthError.code === "too_many_attempts") return 429;
    return null;
  };

  const onSubmit = async ({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) => {
    try {
      const result = await dispatch(fetchAuthToken({ username, password })).unwrap();
      if (result.step === "challenge") {
        navigate(result.mfaType === "totp" ? "/auth/totp" : "/auth/otp");
        return;
      }
      navigate(routes.HomePage);
    } catch (error) {
      emitAuthTelemetry("auth_login_failure", getErrorStatusCode(error));
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Form className="theme-form" onSubmit={handleSubmit(onSubmit)}>
      <h3>{SignInAccount}</h3>
      <p>{"Enter your username & password to login"}</p>

      <FormGroup>
        <Label className="col-form-label">{EmailAddress}</Label>
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <SmartInput
              {...field}
              defaultText="Your email address"
            />
          )}
        />
        {errors.username && (
          <p className="text-danger mt-1">{errors.username.message}</p>
        )}
      </FormGroup>

      <FormGroup>
        <Label className="col-form-label">{Password}</Label>
        <div className="form-input position-relative">
          <input
            className="form-control"
            type={isPasswordVisible ? "text" : "password"}
            {...register("password")}
          />
          <div className="show-hide" onClick={toggle}>
            <span className={!isPasswordVisible ? "show" : ""}></span>
          </div>
        </div>
        {errors.password && (
          <p className="text-danger mt-1">{errors.password.message}</p>
        )}
      </FormGroup>

      <div className="form-group d-flex justify-content-end mt-2">
        <Link to={Href || "#"} className="text-end primary">
          {ForgotPassword || "Forgot Password?"}
        </Link>
      </div>

      {/* Sign In Button - full width */}
      <div className="form-group mt-3">
        <Button color="primary" className="w-100">
          {SignIn || "Sign In"}
        </Button>
      </div>

    </Form>
  );
};

export default SignInForm;
