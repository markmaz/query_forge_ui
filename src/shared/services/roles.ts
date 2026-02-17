import api from "./api";
import type { Role } from "../../entities/Role";
import axios from "axios";

const normalizeRolesError = (error: unknown): Error => {
  if (!axios.isAxiosError(error)) return new Error("Unable to load role catalog.");
  const data = error.response?.data as { error?: string; message?: string } | undefined;
  const message = data?.error ?? data?.message ?? error.message ?? "Unable to load role catalog.";
  const err = new Error(message) as Error & { status?: number };
  err.status = error.response?.status;
  return err;
};

export const fetchRoles = async (): Promise<Role[]> => {
  try {
    const response = await api.get<Role[]>(`/roles`);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    throw normalizeRolesError(error);
  }
};
