import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from '../../../shared/lib/hooks';
import { generateOTP } from '../../../shared/api/otp';
import { verifyOtpAndStoreToken } from '../model/authSlice';
import { routes } from '../../../app/routes/routes';
export type OtpFormProps = {
  userId: string;
};

const OtpForm: React.FC<OtpFormProps> = ({ userId }) => {
  const OTP_LENGTH = 6; // ⬅️ NEW: single source of truth
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState<number>(30);
  const [canGenerate, setCanGenerate] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');         // ⬅️ NEW
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isSubmittingRef = useRef(false);                        // ⬅️ NEW
  const lastAutoSubmittedOtpRef = useRef<string | null>(null);  // ⬅️ NEW

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const email = useAppSelector((state) => state.auth.email);

  useEffect(() => {
    const timer = countdown > 0 && setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    if (countdown === 0) setCanGenerate(true);
    return () => clearInterval(timer as NodeJS.Timeout);
  }, [countdown]);

  useEffect(() => {
    const generateInitialOtp = async () => {
      if (!userId) return;
      try {
        await generateOTP(userId);
      } catch (error) {
        // You could show a toast if you prefer
        console.error("OTP generation failed:", error);
      }
    };
    generateInitialOtp();
  }, [userId]);

  useEffect(() => {
    // ⬅️ NEW: focus first box on load
    const id = window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const distributeOtp = (startIndex: number, rawValue: string, focusLast = true) => { // ⬅️ NEW
    const digits = rawValue.replace(/\D/g, '').slice(0, OTP_LENGTH - startIndex);
    if (!digits) return;
    setOtpError('');
    const newOtp = [...otp];
    digits.split('').forEach((digit, offset) => {
      newOtp[startIndex + offset] = digit;
    });
    setOtp(newOtp);
    if (focusLast) {
      const lastIndex = Math.min(startIndex + digits.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
    }
    const fullOtp = newOtp.join('');
    if (fullOtp.length === OTP_LENGTH) {
      triggerAutoSubmit(fullOtp);
    }
  };

  const submitOtp = async (fullOtp: string) => { // ⬅️ NEW
    if (!userId || isSubmittingRef.current) return;
    if (fullOtp.length < OTP_LENGTH) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }
    setOtpError('');
    isSubmittingRef.current = true;
    try {
      const resultAction = await dispatch(verifyOtpAndStoreToken({ user_id: userId, otp: fullOtp }));
      if (verifyOtpAndStoreToken.fulfilled.match(resultAction)) {
        navigate(routes.HomePage);
      } else {
        setOtpError('Incorrect passcode. Please try again.');
        lastAutoSubmittedOtpRef.current = null;
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setOtpError('Something went wrong. Please try again.');
      lastAutoSubmittedOtpRef.current = null;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const triggerAutoSubmit = (fullOtp: string) => { // ⬅️ NEW
    if (lastAutoSubmittedOtpRef.current === fullOtp) return;
    lastAutoSubmittedOtpRef.current = fullOtp;
    void submitOtp(fullOtp);
  };

  const handleChange = (index: number, value: string) => {
    // ⬅️ NEW: support multi-char autofill/paste in a single input
    if (value.length > 1) {
      distributeOtp(index, value);
      return;
    }
    if (!/^\d?$/.test(value)) return; // only allow digits
    setOtpError('');                  // clear error on change
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newOtp.join('').length === OTP_LENGTH) {
      triggerAutoSubmit(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault(); // ⬅️ NEW: custom backspace behavior
      const newOtp = [...otp];
      if (newOtp[index]) {
        newOtp[index] = '';
        setOtp(newOtp);
        return;
      }
      if (index > 0) {
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) { // ⬅️ NEW
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) { // ⬅️ NEW
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent) => { // ⬅️ NEW
    e.preventDefault();
    e.stopPropagation();
    const text = e.clipboardData?.getData('text') ?? '';
    distributeOtp(index, text);
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => { // ⬅️ NEW (optional)
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    e.preventDefault();
    const text = e.clipboardData?.getData('text') ?? '';
    distributeOtp(0, text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    await submitOtp(fullOtp);
  };

  const handleGenerateOtp = async () => {
    setCountdown(30);
    setCanGenerate(false);
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    inputRefs.current[0]?.focus();
    lastAutoSubmittedOtpRef.current = null; // ⬅️ NEW

    if (!userId) return;

    try {
      await generateOTP(userId);
    } catch (error) {
      console.error("Error generating OTP:", error);
      setOtpError('Could not generate a new code. Please try again.');
    }
  };

  return (
    <form className="theme-form" onSubmit={handleSubmit}>
      <h3>Enter Verification Code</h3>

      <div className="otp-input-container" onPaste={handleContainerPaste}> {/* ⬅️ NEW */}
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
            onPaste={e => handlePaste(index, e)} // ⬅️ NEW
            inputMode="numeric"                 // ⬅️ NEW
            pattern="\\d*"                       // ⬅️ NEW
            autoComplete={index === 0 ? 'one-time-code' : 'off'} // ⬅️ NEW
            className={`otp-box ${otpError ? 'is-invalid' : ''}`}
            aria-invalid={!!otpError}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      <div className="otp-email-notice">
        <p className='otp-email-text'>We sent an email with the code to:</p>
        <p className='otp-email-text'><strong>{email}</strong></p>
      </div>

      <div className="btn-showcase">
        <button type="submit" className="btn btn-primary">
          Submit
        </button>

        <button
          type="button"
          onClick={handleGenerateOtp}
          disabled={!canGenerate}
          className={`btn ${canGenerate ? 'btn-secondary' : 'btn-secondary disabled'}`}
        >
          {canGenerate ? 'Generate new OTP' : `Generate new OTP (${countdown})`}
        </button>
      </div>

      {/* Red error at the bottom */}
      {otpError && (
        <div className="alert alert-danger mt-3" role="alert" aria-live="polite">
          {otpError}
        </div>
      )}
    </form>
  );
};

export default OtpForm;
