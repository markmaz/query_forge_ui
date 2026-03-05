import api from "@/shared/services/api";
import type { HealthCheck } from "../types";

export async function fetchDetailedHealth(): Promise<HealthCheck> {
  const { data } = await api.get<HealthCheck>("/admin/health/detailed");
  return data;
}
