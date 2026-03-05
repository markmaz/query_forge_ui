import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../shared/lib/hooks";
import {
  expireOtpChallenge,
  resetAuthFlow,
  type AuthThunkError,
  verifyTotpAndStoreToken,
} from "../model/authSlice";
import { routes } from "../../../app/routes/routes";

const TOTP_LENGTH = 6;

const formatRemaining = (secondsLeft: number) => {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const normalizeNumericInput = (rawValue: string) =>
  Array.from(String(rawValue ?? ""))
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660); // Arabic-Indic
      if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0); // Eastern Arabic-Indic
      if (code >= 0xff10 && code <= 0xff19) return String(code - 0xff10); // Full-width
      return char;
    })
    .join("");

const TotpForm: React.FC = () => {
  const [totp, setTotp] = useState<string[]>(Array(TOTP_LENGTH).fill(""));
  const [totpError, setTotpError] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const handlingExpiryRef = useRef(false);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { authStep, mfaType, challengeExpiresAt, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const id = window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (authStep !== "otp_required" || mfaType !== "totp" || !challengeExpiresAt) {
      navigate("/auth", { replace: true });
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((challengeExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !handlingExpiryRef.current) {
        handlingExpiryRef.current = true;
        dispatch(expireOtpChallenge());
        toast.error("Invalid code or expired challenge.");
        navigate("/auth", { replace: true });
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [authStep, challengeExpiresAt, dispatch, mfaType, navigate]);

  const remainingText = useMemo(() => formatRemaining(secondsLeft), [secondsLeft]);

  const distributeTotp = (startIndex: number, rawValue: string) => {
    const digits = normalizeNumericInput(rawValue).replace(/\D/g, "").slice(0, TOTP_LENGTH - startIndex);
    if (!digits) return;

    setTotpError("");
    const next = [...totp];
    digits.split("").forEach((digit, offset) => {
      next[startIndex + offset] = digit;
    });
    setTotp(next);

    const lastIndex = Math.min(startIndex + digits.length - 1, TOTP_LENGTH - 1);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const normalizedValue = normalizeNumericInput(value);

    if (normalizedValue.length > 1) {
      distributeTotp(index, normalizedValue);
      return;
    }
    if (!/^\d?$/.test(normalizedValue)) return;

    setTotpError("");
    const next = [...totp];
    next[index] = normalizedValue;
    setTotp(next);
    if (normalizedValue && index < TOTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...totp];
      if (next[index]) {
        next[index] = "";
        setTotp(next);
        return;
      }
      if (index > 0) {
        next[index - 1] = "";
        setTotp(next);
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < TOTP_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text") ?? "";
    distributeTotp(index, normalizeNumericInput(text));
  };

  const handleBackToLogin = () => {
    dispatch(resetAuthFlow());
    navigate("/auth", { replace: true });
  };

  const getErrorMessage = (error: unknown) => {
    const fallback = "Unable to verify authenticator code. Please try again.";
    if (!error || typeof error !== "object") return fallback;
    const authError = error as Partial<AuthThunkError>;
    if (authError.code === "invalid_mfa_code") return "Invalid code or expired challenge.";
    if (authError.code === "retry_later") return "Too many attempts. Please try again later.";
    return authError.message ?? fallback;
  };

  const getErrorCode = (error: unknown) => {
    if (!error || typeof error !== "object") return "unknown";
    return (error as Partial<AuthThunkError>).code ?? "unknown";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const digits = normalizeNumericInput(totp.join("")).replace(/\D/g, "");
    if (!digits) {
      setTotpError("Code is required.");
      return;
    }

    const normalizedCode = digits.slice(-TOTP_LENGTH).padStart(TOTP_LENGTH, "0");
    setTotpError("");

    try {
      await dispatch(verifyTotpAndStoreToken({ code: normalizedCode })).unwrap();
      navigate(routes.HomePage);
    } catch (error) {
      const codeValue = getErrorCode(error);
      const message = getErrorMessage(error);
      if (codeValue === "invalid_or_expired_challenge" || codeValue === "challenge_expired") {
        toast.error(message);
        navigate("/auth", { replace: true });
        return;
      }
      setTotpError(message);
    }
  };

  return (
    <form className="theme-form" onSubmit={handleSubmit} noValidate>
      <h3>Authenticator App Verification</h3>
      <p>Enter the 6-digit code from your authenticator app.</p>
      <p className="text-muted small">Challenge expires in {remainingText}</p>

      <div className="otp-input-container">
        {totp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            maxLength={1}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            className={`otp-box ${totpError ? "is-invalid" : ""}`}
            aria-invalid={!!totpError}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      <div className="btn-showcase">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Verifying..." : "Submit"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleBackToLogin} disabled={loading}>
          Back to login
        </button>
      </div>

      {totpError ? (
        <div className="alert alert-danger mt-3" role="alert" aria-live="polite">
          {totpError}
        </div>
      ) : null}
    </form>
  );
};

export default TotpForm;
