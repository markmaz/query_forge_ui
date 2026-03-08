import { useEffect, useMemo, useState } from "react";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Form, FormGroup, Label } from "reactstrap";
import { toast } from "react-toastify";

import { emitAuthTelemetry } from "../../../shared/runtime/authTelemetry";
import { acceptInvite, type AcceptInvitePayload, validateInviteToken } from "../../../shared/services/users";

const INVALID_INVITE_MESSAGE = "Invite link invalid or expired";
const USED_INVITE_MESSAGE = "Invite already used";
const EMAIL_MISMATCH_MESSAGE = "Invite email mismatch. Use the same email address that received the invite.";
const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 15 characters and include uppercase, lowercase, number, and special character.";
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{15,}$/;

type InviteAcceptFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const getSchema = (invitedEmail: string | null) =>
  yup.object({
    firstName: yup.string().trim().required("First name is required"),
    lastName: yup.string().trim().required("Last name is required"),
    email: yup
      .string()
      .trim()
      .email("Email is invalid")
      .required("Email is required")
      .test("matches-invite-email", "Email must match the invited email address.", (value) => {
        if (!invitedEmail) return true;
        if (!value) return false;
        return invitedEmail.toLowerCase() === value.toLowerCase();
      }),
    password: yup.string().matches(passwordRegex, PASSWORD_POLICY_MESSAGE).required("Password is required"),
    confirmPassword: yup
      .string()
      .required("Please confirm your password")
      .oneOf([yup.ref("password")], "Passwords must match"),
  });

function toStatusCode(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : null;
}

function toSubmitError(error: unknown): string {
  const status = toStatusCode(error);
  if (status === 400) return INVALID_INVITE_MESSAGE;
  if (status === 403) return EMAIL_MISMATCH_MESSAGE;
  if (status === 409) return USED_INVITE_MESSAGE;
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : "Unable to accept invite.";
}

const InviteAcceptPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingInvite, setIsValidatingInvite] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const togglePasswordVisibility = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  const inviteToken = useMemo(() => {
    const token = new URLSearchParams(location.search).get("token");
    return typeof token === "string" ? token.trim() : "";
  }, [location.search]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
  } = useForm<InviteAcceptFormValues>({
    resolver: yupResolver(getSchema(invitedEmail)),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let isMounted = true;

    if (!inviteToken) {
      setInvitedEmail(null);
      setInviteError(INVALID_INVITE_MESSAGE);
      return;
    }

    setIsValidatingInvite(true);
    setInviteError(null);
    setSubmitError(null);

    void (async () => {
      try {
        const invite = await validateInviteToken(inviteToken);
        if (!isMounted) return;
        const email = typeof invite.email === "string" ? invite.email.trim() : "";
        const normalizedEmail = email.length > 0 ? email : null;
        setInvitedEmail(normalizedEmail);
        if (normalizedEmail) {
          setValue("email", normalizedEmail, {
            shouldTouch: true,
            shouldValidate: true,
          });
        }
      } catch (error) {
        if (!isMounted) return;
        emitAuthTelemetry("auth_invite_validation_failure", toStatusCode(error));
        setInvitedEmail(null);
        setInviteError(INVALID_INVITE_MESSAGE);
      } finally {
        if (isMounted) {
          setIsValidatingInvite(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [inviteToken, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    if (!inviteToken) {
      setSubmitError(INVALID_INVITE_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: AcceptInvitePayload = {
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      password: values.password,
      email: values.email.trim(),
    };

    try {
      await acceptInvite(inviteToken, payload);
      toast.success("Invite accepted");
      navigate("/auth");
    } catch (error) {
      setSubmitError(toSubmitError(error));
    } finally {
      setIsSubmitting(false);
    }
  });

  const isSubmitDisabled = Boolean(
    !inviteToken || inviteError || !isValid || isSubmitting || isValidatingInvite
  );

  return (
    <Form className="theme-form" onSubmit={onSubmit} noValidate>
      <h3>Accept Invitation</h3>
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
        {invitedEmail ? `Invited as ${invitedEmail}. ` : ""}
        Please complete your profile to finish onboarding.
      </p>

      <FormGroup>
        <Label className="col-form-label" for="invite-first-name">
          First Name
        </Label>
        <input
          id="invite-first-name"
          type="text"
          className={`form-control${errors.firstName ? " is-invalid" : ""}`}
          {...register("firstName")}
        />
        {errors.firstName ? <p className="text-danger mt-1">{errors.firstName.message}</p> : null}
      </FormGroup>

      <FormGroup>
        <Label className="col-form-label" for="invite-last-name">
          Last Name
        </Label>
        <input
          id="invite-last-name"
          type="text"
          className={`form-control${errors.lastName ? " is-invalid" : ""}`}
          {...register("lastName")}
        />
        {errors.lastName ? <p className="text-danger mt-1">{errors.lastName.message}</p> : null}
      </FormGroup>

      <FormGroup>
        <Label className="col-form-label" for="invite-email">
          Email
        </Label>
        <input
          id="invite-email"
          type="email"
          className={`form-control${errors.email ? " is-invalid" : ""}`}
          {...register("email")}
        />
        {errors.email ? <p className="text-danger mt-1">{errors.email.message}</p> : null}
      </FormGroup>

      <FormGroup>
        <Label className="col-form-label" for="invite-password">
          Password
        </Label>
        <div className="form-input position-relative">
          <input
            id="invite-password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="new-password"
            className={`form-control${errors.password ? " is-invalid" : ""}`}
            {...register("password")}
          />
          <div className="show-hide" onClick={togglePasswordVisibility}>
            <span className={!isPasswordVisible ? "show" : ""}></span>
          </div>
        </div>
        {errors.password ? <p className="text-danger mt-1">{errors.password.message}</p> : null}
      </FormGroup>

      <FormGroup>
        <Label className="col-form-label" for="invite-confirm-password">
          Confirm Password
        </Label>
        <div className="form-input position-relative">
          <input
            id="invite-confirm-password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="new-password"
            className={`form-control${errors.confirmPassword ? " is-invalid" : ""}`}
            {...register("confirmPassword")}
          />
          <div className="show-hide" onClick={togglePasswordVisibility}>
            <span className={!isPasswordVisible ? "show" : ""}></span>
          </div>
        </div>
        {errors.confirmPassword ? <p className="text-danger mt-1">{errors.confirmPassword.message}</p> : null}
      </FormGroup>

      <div className="form-group mt-3">
        <Button color="primary" className="w-100" disabled={isSubmitDisabled}>
          {isSubmitting ? "Accepting..." : "Accept Invite"}
        </Button>
      </div>
    </Form>
  );
};

export default InviteAcceptPage;
