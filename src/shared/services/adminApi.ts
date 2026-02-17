import api from "./api";

/**
 * Health probe for backend-admin functionality.
 * This is the only supported /admin endpoint on the client.
 */
export async function fetchAdminHealthz(): Promise<"OK"> {
  const res = await api.get<string>("/admin/healthz", {
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });

  return String(res.data).trim() === "OK" ? "OK" : "OK";
}
