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
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState<number>(30);
  const [canGenerate, setCanGenerate] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');         // ⬅️ NEW
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // only allow digits
    setOtpError('');                  // clear error on change
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(''); // reset
    const fullOtp = otp.join('');

    if (!userId) return;

    if (fullOtp.length < 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }

    try {
      const resultAction = await dispatch(verifyOtpAndStoreToken({ user_id: userId, otp: fullOtp }));
      if (verifyOtpAndStoreToken.fulfilled.match(resultAction)) {
        navigate(routes.HomePage);
      } else {
        // Rejected or server said no — show red error
        setOtpError('Incorrect passcode. Please try again.');
      }
    } catch (error) {
      // Network/unexpected
      console.error("Unexpected error:", error);
      setOtpError('Something went wrong. Please try again.');
    }
  };

  const handleGenerateOtp = async () => {
    setCountdown(30);
    setCanGenerate(false);
    setOtp(Array(6).fill(''));
    setOtpError('');
    inputRefs.current[0]?.focus();

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

      <div className="otp-input-container">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
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
