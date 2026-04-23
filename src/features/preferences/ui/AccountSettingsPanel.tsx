import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Col, Row } from "reactstrap";
import { setUser } from "../../access-admin/model/userSlice";
import { updateOwnProfile } from "../../../shared/services/users";
import { useAppDispatch, useAppSelector } from "../../../shared/runtime/hooks";
import {
  confirmTotpEnrollment,
  disableTotp,
  isAdmin,
  startTotpEnrollment,
  type TotpStartResponse,
} from "../../../shared/services/auth";
import { getAccessToken } from "../../../shared/runtime/accessTokenStore";
import UserAccessRolesSection from "../../access-admin/ui/UserAccessRolesSection";
import "./accountSettings.css";

type ProfileDraft = {
  firstName: string;
  lastName: string;
  email: string;
};

type PasswordDraft = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type TotpDisableDraft = {
  password: string;
  code: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatValue = (value: string | null | undefined, fallback = "—") =>
  String(value ?? "").trim() || fallback;

const formatFeatureName = (value: string) =>
  value
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDateTime = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Never";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return raw;
  return parsed.toLocaleString();
};

const normalizeSixDigitCode = (value: string) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") return fallback;
  const maybeError = error as { message?: string; status?: number };
  if (typeof maybeError.message === "string" && maybeError.message.trim())
    return maybeError.message.trim();
  return fallback;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "enabled", "on", "required"].includes(normalized))
    return true;
  if (["false", "0", "no", "disabled", "off"].includes(normalized))
    return false;
  return null;
};

const isTotpLike = (value: unknown): boolean => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("totp") ||
    normalized.includes("authenticator") ||
    normalized.includes("otp") ||
    normalized === "required"
  );
};

const inferTotpEnabled = (profile: unknown): boolean => {
  const record = asRecord(profile);
  if (!record) return false;

  const explicitKeys = [
    "totp_enabled",
    "totp_enrolled",
    "mfa_enabled",
    "two_factor_enabled",
    "authenticator_enabled",
    "otp_enabled",
  ] as const;

  for (const key of explicitKeys) {
    const parsed = parseBoolean(record[key]);
    if (parsed !== null) return parsed;
  }

  if (isTotpLike(record.two_factor_preference)) return true;
  if (isTotpLike(record.mfa_type)) return true;

  const methodCollections = [
    record.mfa_methods,
    record.two_factor_methods,
    record.auth_methods,
  ];

  for (const collection of methodCollections) {
    if (!Array.isArray(collection)) continue;
    for (const method of collection) {
      if (isTotpLike(method)) return true;
      const methodRecord = asRecord(method);
      if (!methodRecord) continue;
      if (
        isTotpLike(methodRecord.type) ||
        isTotpLike(methodRecord.method) ||
        isTotpLike(methodRecord.name)
      ) {
        const enabled = parseBoolean(
          methodRecord.enabled ?? methodRecord.active,
        );
        if (enabled === null || enabled) return true;
      }
    }
  }

  return false;
};

const AccountSettingsPanel = () => {
  const dispatch = useAppDispatch();
  const userProfile = useAppSelector((state) => state.user.user);
  const rolesByFeature = useAppSelector(
    (state) => state.user.rolesByFeature ?? {},
  );
  const capabilities = useAppSelector((state) => state.user.capabilities ?? []);
  const canEditOwnDirectRoles = isAdmin(getAccessToken());

  const initialProfile = useMemo<ProfileDraft>(
    () => ({
      firstName: formatValue(userProfile?.first_name, ""),
      lastName: formatValue(userProfile?.last_name, ""),
      email: formatValue(userProfile?.email, ""),
    }),
    [userProfile?.first_name, userProfile?.last_name, userProfile?.email],
  );

  const [profileDraft, setProfileDraft] =
    useState<ProfileDraft>(initialProfile);
  const [profileMessage, setProfileMessage] = useState<string>("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState<string>("");
  const [totpEnabled, setTotpEnabled] = useState<boolean>(false);
  const [totpSetupData, setTotpSetupData] = useState<TotpStartResponse | null>(
    null,
  );
  const [totpConfirmCode, setTotpConfirmCode] = useState("");
  const [totpDisableDraft, setTotpDisableDraft] = useState<TotpDisableDraft>({
    password: "",
    code: "",
  });
  const [totpBusyAction, setTotpBusyAction] = useState<
    "start" | "confirm" | "disable" | null
  >(null);
  const [totpError, setTotpError] = useState("");
  const [totpMessage, setTotpMessage] = useState("");

  const isProfileDirty =
    profileDraft.firstName !== initialProfile.firstName ||
    profileDraft.lastName !== initialProfile.lastName ||
    profileDraft.email !== initialProfile.email;

  const isEmailValid = EMAIL_REGEX.test(profileDraft.email);

  const passwordChecks = useMemo(
    () => ({
      length: passwordDraft.newPassword.length >= 15,
      uppercase: /[A-Z]/.test(passwordDraft.newPassword),
      lowercase: /[a-z]/.test(passwordDraft.newPassword),
      number: /\d/.test(passwordDraft.newPassword),
      symbol: /[\W_]/.test(passwordDraft.newPassword),
      match:
        passwordDraft.newPassword.length > 0 &&
        passwordDraft.confirmPassword.length > 0 &&
        passwordDraft.newPassword === passwordDraft.confirmPassword,
    }),
    [passwordDraft.confirmPassword, passwordDraft.newPassword],
  );

  const canSubmitPassword =
    passwordDraft.currentPassword.trim().length > 0 &&
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.number &&
    passwordChecks.symbol &&
    passwordChecks.match;

  const permissionRows = useMemo(
    () =>
      Object.entries(rolesByFeature).map(([feature, roles]) => ({
        feature,
        roles: (roles ?? []).filter(Boolean),
      })),
    [rolesByFeature],
  );

  useEffect(() => {
    setProfileDraft(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    setTotpEnabled(inferTotpEnabled(userProfile));
  }, [userProfile]);

  const onProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEmailValid) {
      setProfileMessage("Enter a valid email address.");
      return;
    }
    if (!userProfile?.user_id) {
      setProfileMessage("Unable to determine the current user.");
      return;
    }
    setProfileBusy(true);
    try {
      const updated = await updateOwnProfile({
        first_name: profileDraft.firstName.trim() || null,
        last_name: profileDraft.lastName.trim() || null,
        email: profileDraft.email.trim(),
      });
      dispatch(
        setUser({
          ...(userProfile ?? {}),
          ...updated,
          effective_roles:
            (updated as any).effective_roles ?? userProfile?.effective_roles,
          rbac_roles: (updated as any).rbac_roles ?? userProfile?.rbac_roles,
          rbac_role_names:
            (updated as any).rbac_role_names ?? userProfile?.rbac_role_names,
        }),
      );
      setProfileMessage("Profile updated.");
    } catch (error) {
      setProfileMessage(
        getApiErrorMessage(error, "Unable to update profile."),
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const onPasswordSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitPassword) {
      setPasswordMessage("Review the password requirements and try again.");
      return;
    }
    setPasswordMessage(
      "Password reset flow staged. Backend wiring will be added next.",
    );
  };

  const onStartAuthenticatorSetup = async () => {
    setTotpBusyAction("start");
    setTotpError("");
    setTotpMessage("");
    try {
      const data = await startTotpEnrollment();
      setTotpSetupData(data);
      setTotpConfirmCode("");
      setTotpMessage(
        "Scan the QR code, then enter a 6-digit code to confirm setup.",
      );
    } catch (error) {
      setTotpError(
        getApiErrorMessage(error, "Unable to start authenticator setup."),
      );
    } finally {
      setTotpBusyAction(null);
    }
  };

  const onConfirmAuthenticatorSetup = async (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeSixDigitCode(totpConfirmCode);
    if (!code) {
      setTotpError("Enter the 6-digit authenticator code.");
      return;
    }
    setTotpBusyAction("confirm");
    setTotpError("");
    setTotpMessage("");
    try {
      await confirmTotpEnrollment({ code });
      setTotpEnabled(true);
      setTotpSetupData(null);
      setTotpConfirmCode("");
      setTotpMessage("Authenticator App is now enabled.");
    } catch (error) {
      setTotpError(
        getApiErrorMessage(error, "Unable to confirm authenticator setup."),
      );
    } finally {
      setTotpBusyAction(null);
    }
  };

  const onDisableAuthenticator = async (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeSixDigitCode(totpDisableDraft.code);
    if (!totpDisableDraft.password.trim() || !code) {
      setTotpError(
        "Enter your password and a 6-digit authenticator code to disable.",
      );
      return;
    }
    setTotpBusyAction("disable");
    setTotpError("");
    setTotpMessage("");
    try {
      await disableTotp({
        password: totpDisableDraft.password,
        code,
      });
      setTotpEnabled(false);
      setTotpSetupData(null);
      setTotpConfirmCode("");
      setTotpDisableDraft({ password: "", code: "" });
      setTotpMessage("Authenticator App has been disabled.");
    } catch (error) {
      setTotpError(
        getApiErrorMessage(error, "Unable to disable authenticator app."),
      );
    } finally {
      setTotpBusyAction(null);
    }
  };

  return (
    <div className="account-settings-grid">
      <Card className="account-settings-card">
        <CardHeader>
          <h5 className="mb-1">Profile Details</h5>
          <div className="account-settings-muted">
            Update your first name, last name, and account email.
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={onProfileSubmit}>
            <Row className="g-3">
              <Col md="4">
                <label className="form-label" htmlFor="account-first-name">
                  First Name
                </label>
                <input
                  id="account-first-name"
                  className="form-control"
                  value={profileDraft.firstName}
                  onChange={(event) => {
                    setProfileDraft((prev) => ({
                      ...prev,
                      firstName: event.target.value,
                    }));
                    setProfileMessage("");
                  }}
                />
              </Col>
              <Col md="4">
                <label className="form-label" htmlFor="account-last-name">
                  Last Name
                </label>
                <input
                  id="account-last-name"
                  className="form-control"
                  value={profileDraft.lastName}
                  onChange={(event) => {
                    setProfileDraft((prev) => ({
                      ...prev,
                      lastName: event.target.value,
                    }));
                    setProfileMessage("");
                  }}
                />
              </Col>
              <Col md="4">
                <label className="form-label" htmlFor="account-email">
                  Email Address
                </label>
                <input
                  id="account-email"
                  className={`form-control ${profileDraft.email && !isEmailValid ? "is-invalid" : ""}`}
                  type="email"
                  value={profileDraft.email}
                  onChange={(event) => {
                    setProfileDraft((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }));
                    setProfileMessage("");
                  }}
                />
                {profileDraft.email && !isEmailValid ? (
                  <div className="invalid-feedback">
                    Enter a valid email address.
                  </div>
                ) : null}
              </Col>
            </Row>

            <div className="d-flex gap-2 mt-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!isProfileDirty || !isEmailValid || profileBusy}
              >
                {profileBusy ? "Saving..." : "Save Profile Changes"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={!isProfileDirty || profileBusy}
                onClick={() => {
                  setProfileDraft(initialProfile);
                  setProfileMessage("");
                }}
              >
                Reset
              </button>
            </div>
            {profileMessage ? (
              <div
                className="alert alert-info mt-3 mb-0"
                role="status"
                aria-live="polite"
              >
                {profileMessage}
              </div>
            ) : null}
          </form>
        </CardBody>
      </Card>

      <Card className="account-settings-card">
        <CardHeader>
          <h5 className="mb-1">Security & Password</h5>
          <div className="account-settings-muted">
            Set a new password and review policy requirements.
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={onPasswordSubmit}>
            <Row className="g-3">
              <Col md="4">
                <label
                  className="form-label"
                  htmlFor="account-current-password"
                >
                  Current Password
                </label>
                <input
                  id="account-current-password"
                  type="password"
                  className="form-control"
                  value={passwordDraft.currentPassword}
                  onChange={(event) => {
                    setPasswordDraft((prev) => ({
                      ...prev,
                      currentPassword: event.target.value,
                    }));
                    setPasswordMessage("");
                  }}
                />
              </Col>
              <Col md="4">
                <label className="form-label" htmlFor="account-new-password">
                  New Password
                </label>
                <input
                  id="account-new-password"
                  type="password"
                  className="form-control"
                  value={passwordDraft.newPassword}
                  onChange={(event) => {
                    setPasswordDraft((prev) => ({
                      ...prev,
                      newPassword: event.target.value,
                    }));
                    setPasswordMessage("");
                  }}
                />
              </Col>
              <Col md="4">
                <label
                  className="form-label"
                  htmlFor="account-confirm-password"
                >
                  Confirm New Password
                </label>
                <input
                  id="account-confirm-password"
                  type="password"
                  className="form-control"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) => {
                    setPasswordDraft((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }));
                    setPasswordMessage("");
                  }}
                />
              </Col>
            </Row>

            <ul className="mb-0 mt-3">
              <li
                className={
                  passwordChecks.length ? "policy-pass" : "policy-fail"
                }
              >
                At least 15 characters
              </li>
              <li
                className={
                  passwordChecks.uppercase ? "policy-pass" : "policy-fail"
                }
              >
                Includes an uppercase letter
              </li>
              <li
                className={
                  passwordChecks.lowercase ? "policy-pass" : "policy-fail"
                }
              >
                Includes a lowercase letter
              </li>
              <li
                className={
                  passwordChecks.number ? "policy-pass" : "policy-fail"
                }
              >
                Includes a number
              </li>
              <li
                className={
                  passwordChecks.symbol ? "policy-pass" : "policy-fail"
                }
              >
                Includes a special character
              </li>
              <li
                className={passwordChecks.match ? "policy-pass" : "policy-fail"}
              >
                Password confirmation matches
              </li>
            </ul>

            <div className="d-flex gap-2 mt-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canSubmitPassword}
              >
                Reset Password
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setPasswordDraft({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                  setPasswordMessage("");
                }}
              >
                Clear
              </button>
            </div>
            {passwordMessage ? (
              <div
                className="alert alert-info mt-3 mb-0"
                role="status"
                aria-live="polite"
              >
                {passwordMessage}
              </div>
            ) : null}
          </form>
        </CardBody>
      </Card>

      <Card className="account-settings-card">
        <CardHeader>
          <h5 className="mb-1">My Roles</h5>
          <div className="account-settings-muted">
            Direct role assignments and effective access for the currently
            selected workspace.
          </div>
        </CardHeader>
        <CardBody>
          {userProfile?.user_id ? (
            <UserAccessRolesSection
              userId={String(userProfile.user_id)}
              editable={canEditOwnDirectRoles}
              title="My Roles"
              subtitle={
                canEditOwnDirectRoles
                  ? "These direct roles apply in the currently selected workspace."
                  : "Role assignments are read-only here and apply in the currently selected workspace."
              }
              className="mt-0"
            />
          ) : (
            <div className="text-muted">User profile is still loading.</div>
          )}
        </CardBody>
      </Card>

      <Card className="account-settings-card">
        <CardHeader>
          <h5 className="mb-1">Permissions</h5>
          <div className="account-settings-muted">
            Visibility into enabled features, roles, and derived access scopes.
          </div>
        </CardHeader>
        <CardBody>
          {permissionRows.length === 0 ? (
            <div className="text-muted">
              No permissions found for this account.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map(({ feature, roles }) => (
                    <tr key={feature}>
                      <td>{formatFeatureName(feature)}</td>
                      <td>
                        {roles.length === 0 ? (
                          <span className="text-muted">No role assigned</span>
                        ) : (
                          roles.map((role) => (
                            <span
                              className="permission-chip"
                              key={`${feature}:${role}`}
                            >
                              {role}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3">
            <div className="fw-semibold mb-2">Capability Tokens</div>
            {capabilities.length === 0 ? (
              <span className="text-muted">
                No capability tokens available.
              </span>
            ) : (
              capabilities.map((capability) => (
                <span className="permission-chip" key={capability}>
                  {capability}
                </span>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="account-settings-card">
        <CardHeader>
          <h5 className="mb-1">Authenticator App</h5>
          <div className="account-settings-muted">
            Set up or disable TOTP using an authenticator application.
          </div>
        </CardHeader>
        <CardBody>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span
              className={`badge ${totpEnabled ? "text-bg-success" : "text-bg-secondary"}`}
            >
              {totpEnabled ? "Enabled" : "Disabled"}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onStartAuthenticatorSetup}
              disabled={totpBusyAction !== null}
            >
              {totpBusyAction === "start"
                ? "Starting..."
                : "Set up Authenticator App"}
            </button>
          </div>

          {totpSetupData ? (
            <div className="totp-setup-shell">
              <div className="totp-qr-shell">
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(totpSetupData.qr_svg ?? "")}`}
                  alt="TOTP QR code — scan with your authenticator app"
                  width={200}
                  height={200}
                />
              </div>
              <div className="small text-muted mt-2">
                Manual secret:{" "}
                <span className="fw-semibold">
                  {String(totpSetupData.manual_secret_masked ?? "—")}
                </span>
              </div>
              <form className="mt-3" onSubmit={onConfirmAuthenticatorSetup}>
                <label className="form-label" htmlFor="totp-confirm-code">
                  Enter authenticator code to confirm
                </label>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <input
                    id="totp-confirm-code"
                    className="form-control totp-code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totpConfirmCode}
                    onChange={(event) => {
                      setTotpConfirmCode(
                        normalizeSixDigitCode(event.target.value),
                      );
                      setTotpError("");
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-outline-secondary"
                    disabled={
                      totpBusyAction !== null ||
                      normalizeSixDigitCode(totpConfirmCode).length === 0
                    }
                  >
                    {totpBusyAction === "confirm" ? "Confirming..." : "Confirm"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {totpEnabled ? (
            <form className="mt-3" onSubmit={onDisableAuthenticator}>
              <div className="fw-semibold mb-2">Disable Authenticator App</div>
              <Row className="g-2">
                <Col md="4">
                  <label className="form-label" htmlFor="totp-disable-password">
                    Password
                  </label>
                  <input
                    id="totp-disable-password"
                    type="password"
                    className="form-control"
                    value={totpDisableDraft.password}
                    onChange={(event) => {
                      setTotpDisableDraft((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }));
                      setTotpError("");
                    }}
                  />
                </Col>
                <Col md="4">
                  <label className="form-label" htmlFor="totp-disable-code">
                    Authenticator code
                  </label>
                  <input
                    id="totp-disable-code"
                    className="form-control"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totpDisableDraft.code}
                    onChange={(event) => {
                      setTotpDisableDraft((prev) => ({
                        ...prev,
                        code: normalizeSixDigitCode(event.target.value),
                      }));
                      setTotpError("");
                    }}
                  />
                </Col>
                <Col md="4" className="d-flex align-items-end">
                  <button
                    type="submit"
                    className="btn btn-outline-secondary"
                    disabled={totpBusyAction !== null}
                  >
                    {totpBusyAction === "disable" ? "Disabling..." : "Disable"}
                  </button>
                </Col>
              </Row>
            </form>
          ) : null}

          {totpError ? (
            <div
              className="alert alert-danger mt-3 mb-0"
              role="alert"
              aria-live="polite"
            >
              {totpError}
            </div>
          ) : null}
          {totpMessage ? (
            <div
              className="alert alert-info mt-3 mb-0"
              role="status"
              aria-live="polite"
            >
              {totpMessage}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card className="account-settings-card">
        <CardHeader>
          <h5 className="mb-1">Account Summary</h5>
          <div className="account-settings-muted">
            Read-only status and session details.
          </div>
        </CardHeader>
        <CardBody>
          <Row className="g-3">
            <Col md="3">
              <div className="text-muted small">User ID</div>
              <div>{formatValue(userProfile?.user_id)}</div>
            </Col>
            <Col md="3">
              <div className="text-muted small">Account Status</div>
              <div>{formatValue(userProfile?.status, "Unknown")}</div>
            </Col>
            <Col md="3">
              <div className="text-muted small">Last Sign In</div>
              <div>{formatDateTime(userProfile?.last_log_in)}</div>
            </Col>
            <Col md="3">
              <div className="text-muted small">2FA Preference</div>
              <div>
                {formatValue(
                  userProfile?.two_factor_preference,
                  "System default",
                )}
              </div>
            </Col>
          </Row>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <span
              className={`badge ${userProfile?.eula_accepted ? "text-bg-success" : "text-bg-secondary"}`}
            >
              EULA {userProfile?.eula_accepted ? "Accepted" : "Not accepted"}
            </span>
            <span
              className={`badge ${userProfile?.tos_accepted ? "text-bg-success" : "text-bg-secondary"}`}
            >
              ToS {userProfile?.tos_accepted ? "Accepted" : "Not accepted"}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default AccountSettingsPanel;
