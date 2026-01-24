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
import { useAppDispatch } from "../../../shared/lib/hooks";
import { fetchAuthToken } from "../model/authSlice";

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

  const onSubmit = async ({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) => {
    try {
      const response = await dispatch(fetchAuthToken({ username, password })).unwrap();
      console.info("user id:", response.user_id);
      navigate(`/auth/otp/${response.user_id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign in");
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
