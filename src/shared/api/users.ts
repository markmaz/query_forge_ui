import api from "./api";
import { UserProfile, UserInvite, UserProfileUpdate, UserRegistrationProfile, UserStatus } from "../../entities/Users"
/**
 * Fetches user information from the API by user ID.
 *
 * @param user_id - The unique identifier for the user.
 * @returns A promise that resolves to the user's data if successful.
 * @throws Will log an error if the API call fails.
 */
export const fetchUserInfo = async (user_id: string) => {
  try {
    console.log("user_id:" + user_id);
    const response = await api.get(`/users/${user_id}`);
    console.log("User service:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching user information: ", error);
  }
};

// services/users.ts
export async function fetchUsers(
  status: string,
  limit: number,
  cursor: string,
  direction: string,
  q: string = ''
) {
  const params = new URLSearchParams({
    status,
    limit: String(limit),
    ...(cursor ? { cursor } : {}),
    ...(direction ? { direction } : {}),
    ...(q ? { q } : {}),
  });
  const res = await api.get(`/users?${params.toString()}`);
  return res.data
}


export const fetchUserCounts = async() => {
  try{
    const response = await api.get('/users/counts');
    return response.data;
  }catch(error){
    console.error("Error fetching user counts");
  }
}

export const inviteUser = async(payload: UserProfileUpdate) => {
    const response = await api.post('/users', payload);
    return response.data;
}

export const validateInviteToken = async(token: string): Promise<UserInvite> => {
    const response = await api.get(`/auth/invite/validate/${token}`);
    return response.data;
}

export const registerUser = async(payload: UserRegistrationProfile): Promise<UserProfile> => {
  const response = await api.put(`/users/${payload.user_id}`, payload);
  return response.data;
}

export const updateUserInfo = async(payload: UserProfileUpdate): Promise<UserProfile> => {
  const response = await api.put(`/users/${payload.user_id}`, payload);
  return response.data;
}

export const updateUserStatus = async(payload: UserStatus): Promise<UserProfile> => {
  const response = await api.put(`/users/${payload.user_id}`, payload);
  return response.data;
}

export const deleteUser = async(user_id: string) => {
  const response = await api.delete(`/users/${user_id}`);
  return response.data;
}

export const resendInvite = async(payload: UserProfileUpdate) => {
  const response = await api.post(`/users/resend-invite`, payload);
  return response.data;
}

export const inviteUsersBulk = async(payload: {
  emails: string[];
  products: { product_id: string; product_role_id: string }[];
  workspaces: { workspace_id: string | number; is_default?: boolean }[];
}) => {
  const response = await api.post(`/users/bulk-invite`, payload);
  return response.data;
}
