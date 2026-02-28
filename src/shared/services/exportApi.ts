import type { AxiosError } from "axios";
import api from "./api";
import type { SqlQueryJson } from "../../features/query-forge/model/sqlJson";

export type ExportExcelPayload = {
  sqlJson: SqlQueryJson;
  fileName?: string;
  signature?: string;
};

type ExportExcelStartResponse = {
  token: string;
  fileName?: string | null;
  filename?: string | null;
};

const OUTDATED_REQUEST_FORMAT_MESSAGE = "Request format outdated, please refresh and try again.";

const getErrorResponse = (
  error: unknown
): { status?: number; data?: { error?: string; message?: string } } | null => {
  if (!error || typeof error !== "object") return null;
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== "object") return null;
  return response as { status?: number; data?: { error?: string; message?: string } };
};

const isRawSqlRejected = (error: unknown): boolean => {
  const response = getErrorResponse(error);
  if (!response || response.status !== 400) return false;
  const data = response.data;
  const message = String(data?.error ?? data?.message ?? "");
  return /raw sql fields are not allowed/i.test(message);
};

export async function startExcelExport(payload: ExportExcelPayload): Promise<void> {
  try {
    const res = await api.post<ExportExcelStartResponse>("/exports/excel", payload);
    const data = res.data;
    if (!data?.token) throw new Error("Export failed");

    const fileRes = await api.get(`/exports/excel/${data.token}`, { responseType: "blob" });
    const header = fileRes.headers?.["content-disposition"] as string | undefined;
    const filename =
      payload.fileName || data?.fileName || data?.filename || filenameFromDisposition(header) || "export.xlsx";
    triggerBrowserDownload(fileRes.data as Blob, filename);
  } catch (err) {
    if (isRawSqlRejected(err)) {
      throw new Error(OUTDATED_REQUEST_FORMAT_MESSAGE);
    }
    const status = (err as AxiosError | undefined)?.response?.status;
    if (status === 401 || status === 403) {
      throw new Error("Not authorized");
    }
    throw err;
  }
}

function filenameFromDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
  if (!match) return null;
  const raw = match[1].replace(/\"/g, "");
  try {
    return decodeURIComponent(raw).split(/[\\/]/).pop() || null;
  } catch {
    return raw.split(/[\\/]/).pop() || null;
  }
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
