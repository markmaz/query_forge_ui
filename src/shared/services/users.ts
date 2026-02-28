import api from "./api";
import axios from "axios";
import {
  AddUserRoleRequest,
  PatchUserRoleRequest,
  ReplaceUserRolesRequest,
  UserInvite,
  UserProfile,
  UserProfileUpdate,
  UserRegistrationProfile,
  UserResponse,
  UserRolesResponse,
  UserStatus,
} from "../../entities/Users";
import type { Role } from "../../entities/Role";

type ServiceError = Error & {
  status?: number;
  details?: unknown;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  details?: unknown;
};

const sanitizeUserObject = <T>(value: T): T => {
  if (!value || typeof value !== "object") return value;
  const sanitized = { ...(value as Record<string, unknown>) };
  delete sanitized.password;
  delete sanitized.otp_secret;
  return sanitized as T;
};

const sanitizeUserResponse = (value: unknown): UserProfile => sanitizeUserObject(value as UserProfile);

const sanitizeUserListResponse = (value: unknown): UserResponse => {
  const raw = (value ?? {}) as Partial<UserResponse> & { users?: unknown[] };
  return {
    users: Array.isArray(raw.users) ? raw.users.map((row) => sanitizeUserObject(row)) : [],
    next_cursor: raw.next_cursor ?? null,
    prev_cursor: raw.prev_cursor ?? null,
  };
};

const sanitizeRoles = (roles: unknown): Role[] => {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((role) => {
      const raw = role as Partial<Role>;
      if (!raw?.role_id || !raw?.role_name) return null;
      return { role_id: String(raw.role_id), role_name: String(raw.role_name) };
    })
    .filter((role): role is Role => Boolean(role));
};

const sanitizeUserRolesResponse = (value: unknown): UserRolesResponse => {
  const raw = (value ?? {}) as Partial<UserRolesResponse>;
  return {
    user_id: String(raw.user_id ?? ""),
    direct_roles: sanitizeRoles(raw.direct_roles),
    effective_roles: sanitizeRoles(raw.effective_roles),
  };
};

const toUserProfileUpdatePayload = (payload: UserProfileUpdate): UserProfileUpdate => ({
  user_id: payload.user_id ?? null,
  email: payload.email ?? null,
  products: payload.products ?? [],
  workspaces: payload.workspaces ?? [],
  ...(Array.isArray(payload.rbac_role_ids) ? { rbac_role_ids: payload.rbac_role_ids } : {}),
});

const toServiceError = (error: unknown, fallback: string): ServiceError => {
  const serviceError = new Error(fallback) as ServiceError;
  if (!axios.isAxiosError(error)) return serviceError;

  const data = error.response?.data as ApiErrorPayload | undefined;
  serviceError.status = error.response?.status;
  serviceError.details = data?.details ?? data;
  serviceError.message = data?.error ?? data?.message ?? error.message ?? fallback;
  return serviceError;
};

const normalizeApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data as ApiErrorPayload | undefined;
  return data?.error ?? data?.message ?? error.message ?? fallback;
};

/**
 * Fetches user information from the API by user ID.
 */
export const fetchUserInfo = async (user_id: string): Promise<UserProfile | undefined> => {
  try {
    const response = await api.get<UserProfile>(`/users/${user_id}`);
    return sanitizeUserResponse(response.data);
  } catch {
    console.error("Error fetching user information.");
  }
};

export async function fetchUsers(
  status: string,
  limit: number,
  cursor: string,
  direction: string,
  q: string = ""
): Promise<UserResponse> {
  const params = new URLSearchParams({
    status,
    limit: String(limit),
    ...(cursor ? { cursor } : {}),
    ...(direction ? { direction } : {}),
    ...(q ? { q } : {}),
  });
  const res = await api.get<UserResponse>(`/users?${params.toString()}`);
  return sanitizeUserListResponse(res.data);
}

export const fetchUserCounts = async () => {
  try {
    const response = await api.get("/users/counts");
    return response.data;
  } catch {
    console.error("Error fetching user counts");
  }
};

export const inviteUser = async (payload: UserProfileUpdate) => {
  try {
    const response = await api.post("/users", toUserProfileUpdatePayload(payload));
    return response.data;
  } catch (error) {
    throw new Error(normalizeApiErrorMessage(error, "Unable to create user."));
  }
};

export const validateInviteToken = async (token: string): Promise<UserInvite> => {
  try {
    const response = await api.get(`/auth/invite/validate/${token}`);
    return sanitizeUserObject(response.data);
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const err = new Error("Invalid or expired invitation link.") as Error & { status?: number };
    err.status = status;
    throw err;
  }
};

export const registerUser = async (payload: UserRegistrationProfile): Promise<UserProfile> => {
  try {
    const response = await api.put(`/users/${payload.user_id}`, payload);
    return sanitizeUserResponse(response.data);
  } catch (error) {
    throw new Error(normalizeApiErrorMessage(error, "Unable to register user."));
  }
};

export const updateUserInfo = async (payload: UserProfileUpdate): Promise<UserProfile> => {
  try {
    const response = await api.put(`/users/${payload.user_id}`, toUserProfileUpdatePayload(payload));
    return sanitizeUserResponse(response.data);
  } catch (error) {
    throw new Error(normalizeApiErrorMessage(error, "Unable to update user."));
  }
};

export const updateUserStatus = async (payload: UserStatus): Promise<UserProfile> => {
  const response = await api.put(`/users/${payload.user_id}`, payload);
  return sanitizeUserResponse(response.data);
};

export const deleteUser = async (user_id: string) => {
  const response = await api.delete(`/users/${user_id}`);
  return response.data;
};

export const resendInvite = async (payload: UserProfileUpdate) => {
  const response = await api.post(`/users/resend-invite`, toUserProfileUpdatePayload(payload));
  return response.data;
};

export const inviteUsersBulk = async (payload: {
  emails: string[];
  products: { product_id: string; product_role_id: string }[];
  workspaces: { workspace_id: string | number; is_default?: boolean }[];
}) => {
  const response = await api.post(`/users/bulk-invite`, payload);
  return response.data;
};

export const fetchUserRoles = async (userId: string): Promise<UserRolesResponse> => {
  try {
    const response = await api.get(`/users/${userId}/roles`);
    return sanitizeUserRolesResponse(response.data);
  } catch (error) {
    throw toServiceError(error, "Unable to load user roles.");
  }
};

export const addUserRole = async (userId: string, payload: AddUserRoleRequest) => {
  try {
    const response = await api.post(`/users/${userId}/roles`, payload);
    return response.data as {
      mapping: {
        user_id: string;
        role_id: string;
        role_name?: string;
        created: boolean;
      };
    };
  } catch (error) {
    throw toServiceError(error, "Unable to add user role.");
  }
};

export const replaceUserRoles = async (
  userId: string,
  payload: ReplaceUserRolesRequest
): Promise<{ user_id: string; roles: Role[]; count: number }> => {
  try {
    const response = await api.put(`/users/${userId}/roles`, payload);
    const raw = response.data as { user_id?: string; roles?: unknown; count?: number };
    return {
      user_id: String(raw.user_id ?? userId),
      roles: sanitizeRoles(raw.roles),
      count: Number(raw.count ?? 0),
    };
  } catch (error) {
    throw toServiceError(error, "Unable to update user roles.");
  }
};

export const patchUserRole = async (
  userId: string,
  roleId: string,
  payload: PatchUserRoleRequest
): Promise<{ user_id: string; old_role_id: string; new_role_id: string; created: boolean }> => {
  try {
    const response = await api.patch(`/users/${userId}/roles/${roleId}`, payload);
    const raw = response.data as {
      user_id?: string;
      old_role_id?: string;
      new_role_id?: string;
      created?: boolean;
    };
    return {
      user_id: String(raw.user_id ?? userId),
      old_role_id: String(raw.old_role_id ?? roleId),
      new_role_id: String(raw.new_role_id ?? payload.role_id),
      created: Boolean(raw.created),
    };
  } catch (error) {
    throw toServiceError(error, "Unable to replace user role mapping.");
  }
};

export const removeUserRole = async (
  userId: string,
  roleId: string
): Promise<{ user_id: string; role_id: string; deleted: boolean }> => {
  try {
    const response = await api.delete(`/users/${userId}/roles/${roleId}`);
    const raw = response.data as { user_id?: string; role_id?: string; deleted?: boolean };
    return {
      user_id: String(raw.user_id ?? userId),
      role_id: String(raw.role_id ?? roleId),
      deleted: Boolean(raw.deleted),
    };
  } catch (error) {
    throw toServiceError(error, "Unable to remove user role.");
  }
};
