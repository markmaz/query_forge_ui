import api from "./api";

export const generateOTP = async (user_id: string) => {
  try {
    const response = await api.get(`/otp/generate/${user_id}`);
    return response.data;
  } catch (error) {
    console.error("Error generating OTP: ", error);
  }
};