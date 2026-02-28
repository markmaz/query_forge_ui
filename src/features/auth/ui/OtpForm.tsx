import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../shared/lib/hooks";
import {
  expireOtpChallenge,
  resetAuthFlow,
  type AuthThunkError,
  verifyOtpAndStoreToken,
} from "../model/authSlice";
import { routes } from "../../../app/routes/routes";

const OTP_LENGTH = 6;

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

const OtpForm: React.FC = () => {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const handlingExpiryRef = useRef(false);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { authStep, challengeExpiresAt, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const id = window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (authStep !== "otp_required" || !challengeExpiresAt) {
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
  }, [authStep, challengeExpiresAt, dispatch, navigate]);

  const remainingText = useMemo(() => formatRemaining(secondsLeft), [secondsLeft]);

  const distributeOtp = (startIndex: number, rawValue: string) => {
    const digits = normalizeNumericInput(rawValue).replace(/\D/g, "").slice(0, OTP_LENGTH - startIndex);
    if (!digits) return;

    setOtpError("");
    const next = [...otp];
    digits.split("").forEach((digit, offset) => {
      next[startIndex + offset] = digit;
    });
    setOtp(next);

    const lastIndex = Math.min(startIndex + digits.length - 1, OTP_LENGTH - 1);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const normalizedValue = normalizeNumericInput(value);

    if (normalizedValue.length > 1) {
      distributeOtp(index, normalizedValue);
      return;
    }
    if (!/^\d?$/.test(normalizedValue)) return;

    setOtpError("");
    const next = [...otp];
    next[index] = normalizedValue;
    setOtp(next);
    if (normalizedValue && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...otp];
      if (next[index]) {
        next[index] = "";
        setOtp(next);
        return;
      }
      if (index > 0) {
        next[index - 1] = "";
        setOtp(next);
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text") ?? "";
    distributeOtp(index, normalizeNumericInput(text));
  };

  const handleBackToLogin = () => {
    dispatch(resetAuthFlow());
    navigate("/auth", { replace: true });
  };

  const getErrorMessage = (error: unknown) => {
    const fallback = "Unable to verify code. Please try again.";
    if (!error || typeof error !== "object") return fallback;
    return (error as Partial<AuthThunkError>).message ?? fallback;
  };

  const getErrorCode = (error: unknown) => {
    if (!error || typeof error !== "object") return "unknown";
    return (error as Partial<AuthThunkError>).code ?? "unknown";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = normalizeNumericInput(otp.join("")).replace(/\D/g, "");
    if (!digits) {
      setOtpError("Code is required.");
      return;
    }

    const normalizedOtp = digits.slice(-OTP_LENGTH).padStart(OTP_LENGTH, "0");
    setOtpError("");

    try {
      await dispatch(verifyOtpAndStoreToken({ otp: normalizedOtp })).unwrap();
      navigate(routes.HomePage);
    } catch (error) {
      const code = getErrorCode(error);
      const message = getErrorMessage(error);
      if (code === "invalid_or_expired_challenge" || code === "challenge_expired") {
        toast.error(message);
        navigate("/auth", { replace: true });
        return;
      }
      setOtpError(message);
    }
  };

  return (
    <form className="theme-form" onSubmit={handleSubmit} noValidate>
      <h3>Enter Verification Code</h3>
      <p>Enter the 6-digit code to continue.</p>
      <p className="text-muted small">Challenge expires in {remainingText}</p>

      <div className="otp-input-container">
        {otp.map((digit, index) => (
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
            className={`otp-box ${otpError ? "is-invalid" : ""}`}
            aria-invalid={!!otpError}
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

      {otpError && (
        <div className="alert alert-danger mt-3" role="alert" aria-live="polite">
          {otpError}
        </div>
      )}
    </form>
  );
};

export default OtpForm;
