import type { Role } from "../../domain-model/Role";
import axios from "axios";
import { roleClient } from "./clients/roleClient";

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
    const response = await roleClient.fetchRoles();
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    throw normalizeRolesError(error);
  }
};
