import * as yup from "yup";
import { useNavigate} from "react-router-dom";
import { Button, Form, FormGroup, Label } from "reactstrap";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { resetPasswordRequest } from "../../../shared/services/auth";
import { emitAuthTelemetry } from "../../../shared/lib/authTelemetry";

const getSchema = () =>
  yup.object().shape({
    email: yup.string().email('Please enter a valid email address.').required("Email address is required")
  });

const ForgotPasswordForm = () => {
const navigate = useNavigate();

type RegistrationFormValues = {
  email: string
};

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<RegistrationFormValues>({resolver: yupResolver(getSchema()),
  defaultValues: {
    email : ""
  },
});

const onSubmit = async (data: RegistrationFormValues) => {
  try {
    await resetPasswordRequest(data.email);
  } catch (error) {
    const statusCode = typeof (error as { status?: unknown })?.status === "number"
      ? ((error as { status?: number }).status ?? null)
      : null;
    emitAuthTelemetry("auth_reset_request_failure", statusCode);
    // Keep response generic to avoid account-enumeration side channels.
  } finally {
    navigate('/auth/forgot_success');
  }
};

  return (
    <Form className="theme-form" onSubmit={handleSubmit(onSubmit)}>
      <h3>Forgot Password?</h3>
      <p>{"Please enter your email address associated with this account."}</p>

      <FormGroup>
        <Label className="col-form-label">Email Address</Label>
        <input className="form-control" type="text" {...register("email")} />
        {errors.email && (
          <p className="text-danger mt-1">{errors.email.message}</p>
        )}
      </FormGroup>

      <div className="form-group mb-0">
        <div className="text-end mt-3">
          <Button color="primary" className="w-100" block>
            Reset Password
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default ForgotPasswordForm;
