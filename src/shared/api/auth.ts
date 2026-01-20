import api from "./api";
import axios from "axios";

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  user_id: string;
  email: string;
};

export type VerifyOtpPayload = {
  user_id: string;
  otp: string;
};

export type VerifyOtpResponse = {
  token: string;
};

export async function login(credentials: LoginPayload): Promise<LoginResponse> {
  try {
    const res = await api.post<LoginResponse>("/auth/login", credentials, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      const msg =
        (e.response?.data as any)?.message ||
        (e.response?.data as any)?.error ||
        e.response?.statusText ||
        e.message ||
        "Login failed";
      throw new Error(msg);
    }
    throw e;
  }
}

export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  try {
    const res = await api.post<VerifyOtpResponse>("/otp/verify", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      const msg =
        (e.response?.data as any)?.message ||
        (e.response?.data as any)?.error ||
        e.response?.statusText ||
        e.message ||
        "OTP verification failed";
      throw new Error(msg);
    }
    throw e;
  }
}

export const resetPasswordRequest = async(email: string) => {
    try {
        const data = {email};
        const response = await api.post(`/auth/reset/request`, data);
        return response.data;
    }catch (error){
        console.error("Unexpected error: ", error);
    }
}

export const validateResetToken = async(token: string) => {
    try{
        const data = {token};
        const response = await api.post(`/auth/reset/validate`, data);
        return response.data;
    }catch(error){
        console.error("Unexpected error: ", error);
    }
}

export const resetPassword = async(password: string) => {
    try{
        const data = {password};
        const response = await api.post(`/auth/reset/password`, data);
        
        if(response.status !== 204){
            throw Error("Password was not reset");
        }
    }catch(error){
        console.error("Unexpected error: ", error);
        throw Error("Password not reset.")
    }
}