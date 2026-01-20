import type { AxiosError } from "axios";
import api from "./api";
import type { SqlQueryJson } from "../../features/no-code-sql/model/sqlJson";

export type ExportExcelPayload = {
  sqlJson: SqlQueryJson;
  filename: string;
};

type ExportExcelStartResponse = {
  token: string;
  filename?: string | null;
};

export async function startExcelExport(payload: ExportExcelPayload): Promise<void> {
  try {
    const res = await api.post<ExportExcelStartResponse>("/exports/excel", payload);
    const data = res.data;
    if (!data?.token) throw new Error("Export failed");

    const fileRes = await api.get(`/exports/excel/${data.token}`, { responseType: "blob" });
    const header = fileRes.headers?.["content-disposition"] as string | undefined;
    const filename =
      payload.filename || data?.filename || filenameFromDisposition(header) || "export.xlsx";
    triggerBrowserDownload(fileRes.data as Blob, filename);
  } catch (err) {
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
