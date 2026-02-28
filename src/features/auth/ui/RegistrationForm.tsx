import * as yup from "yup";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Form, FormGroup, Label } from "reactstrap";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { registerUser, validateInviteToken } from "../../../shared/services/users";
import { emitAuthTelemetry } from "../../../shared/lib/authTelemetry";
import { UserInvite, UserRegistrationProfile } from "../../../entities/Users";

const Password = "Password";
const INVALID_INVITE_MESSAGE = "Invalid or expired invitation link.";
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
    firstName: yup.string().required("First name is required"),
    lastName: yup.string().required("Last name is required"),
  });

const RegistrationForm = () => {
  const query = new URLSearchParams(useLocation().search);
  const token = query.get("token");
  const navigate = useNavigate();
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const toggle = () => setPasswordVisible(!isPasswordVisible);

  const [user, setUser] = useState<UserInvite | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

   useEffect(() => {
    const fetchUser = async () => {
        if (!token) {
          setUser(null);
          setInviteError(INVALID_INVITE_MESSAGE);
          return;
        }

        try {
            const userData = await validateInviteToken(token);
            setUser(userData);
            setInviteError(null);
            } catch (error) {
                const statusCode = typeof (error as { status?: unknown })?.status === "number"
                  ? ((error as { status?: number }).status ?? null)
                  : null;
                emitAuthTelemetry("auth_invite_validation_failure", statusCode);
                setUser(null);
                setInviteError(INVALID_INVITE_MESSAGE);
            }
        };

        fetchUser();
    }, [token]);

type RegistrationFormValues = {
  password: string;
  confirmPassword?: string;
  firstName: string;
  lastName: string;
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
    firstName: "",
    lastName: "",
  },
});

const passwordRegister = register("password");

const onSubmit = async (data: RegistrationFormValues) => {
  if (!user || inviteError) {
    setSubmitError(INVALID_INVITE_MESSAGE);
    return;
  }

  const { password, firstName, lastName } = data;
  setSubmitError(null);
  // Do something with form data
    const payload: UserRegistrationProfile = {
            first_name:firstName,
            last_name: lastName,
            password: password,
            user_id: user?.user_id,
            email: user?.email,
            status: 'Active'
        };
    
    try{
        const data = await registerUser(payload);

        if(data){
          toast.success("You registered successfully. Please log in.");
          navigate("/auth/success");
        }

    } catch(error: any){
        const message = error?.message ?? "Unable to register user.";
        setSubmitError(message);
        setError("password", { type: "server", message });
    }
};

  return (
    <Form className="theme-form" onSubmit={handleSubmit(onSubmit)}>
      <h3>Register</h3>
      {inviteError ? (
        <div className="alert alert-danger" role="alert" aria-live="polite">
          {inviteError}
        </div>
      ) : null}
      {submitError ? (
        <div className="alert alert-danger" role="alert" aria-live="polite">
          {submitError}
        </div>
      ) : null}
      <p>
        {user?.email ? `Invited as ${user.email}. ` : ""}
        {"Please enter the following information to create your Query Studio account."}
      </p>

      <FormGroup>
        <Label className="col-form-label">First Name</Label>
        <input className="form-control" type="text" {...register("firstName")} />
        {errors.firstName && (
          <p className="text-danger mt-1">{errors.firstName.message}</p>
        )}
      </FormGroup>

      <FormGroup>
        <Label className="col-form-label">Last Name</Label>
        <input className="form-control" type="text" {...register("lastName")} />
        {errors.lastName && (
          <p className="text-danger mt-1">{errors.lastName.message}</p>
        )}
      </FormGroup>

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

      <div className="form-group mt-3">
        <Button color="primary" className="w-100" disabled={!user || !!inviteError}>
          Register
        </Button>
      </div>
    </Form>
  );
};

export default RegistrationForm;
