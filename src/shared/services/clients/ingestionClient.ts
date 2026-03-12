import api from "../api";
import type { SyncRequest } from "../ingestion";

export const ingestionClient = {
  startSync(payload: SyncRequest) {
    return api.post("/ingestion/sync", payload);
  },
  getStatus(jobId: string) {
    return api.get(`/ingestion/status/${jobId}`);
  },
  getDiagnostics(jobId: string) {
    return api.get(`/ingestion/diagnostics/${jobId}`);
  },
  cancelRun(jobId: string) {
    return api.post(`/ingestion/cancel/${jobId}`);
  },
  getHistory() {
    return api.get("/ingestion/history");
  },
  getDatasources() {
    return api.get("/datasources");
  },
  getSchemas(datasource: string, catalog: string | null) {
    const params: Record<string, string> = { datasource };
    if (catalog) params.catalog = catalog;
    return api.get("/ingestion/schemas", { params });
  },
};
