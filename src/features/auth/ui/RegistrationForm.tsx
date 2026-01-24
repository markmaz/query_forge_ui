import * as yup from "yup";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Form, FormGroup, Label } from "reactstrap";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { registerUser, validateInviteToken } from "../../../shared/api/users";
import { UserInvite, UserRegistrationProfile } from "../../../entities/Users";

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

   useEffect(() => {
    const fetchUser = async () => {
        if (!token) return;

        try {
            const userData = await validateInviteToken(token);
            setUser(userData);
            } catch (error) {
                toast.error("Failed to validate token. Please have the helpdesk resend your invitation.");
                console.error("Failed to fetch user info", error);
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

const onSubmit = async (data: RegistrationFormValues) => {
  const { password, firstName, lastName } = data;
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

    }catch(error: any){
        toast.error(error?.message)
    }
};

  return (
    <Form className="theme-form" onSubmit={handleSubmit(onSubmit)}>
      <h3>Register: {user?.email}</h3>
      <p>{"Please enter the following information to create your Query Studio account."}</p>

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

export default RegistrationForm;
