import api from "./api";
import axios from "axios";
import type { AxiosResponse } from "axios";
import type { UploadResult } from "../../features/crosswalks/ui/components/UploadWizardModal";
import {
  ValueOverrideIndexSchema,
  ValueOverridePreviewSchema,
  ValueOverrideTypeSchema,
  type ValueOverrideType,
  type ValueOverrideIndexResponse,
  type ValueOverridePreviewResponse,
  type ValueOverrideMeta,
} from "../../features/crosswalks/model/valueOverrideSchemas";
import { toast } from "react-toastify";
import { z } from "zod";
import type { ListRow, SectionKey } from "../../features/crosswalks/ui/components/ListSectionCard";

const ValueOverridePatchSchema = z.object({
  listId: z.string(),
  type: ValueOverrideTypeSchema,
  isShared: z.boolean(),
});

export type ValueOverrideMutationErrorCode = "permission_denied" | "not_found" | "unknown";

export class ValueOverrideMutationError extends Error {
  status?: number;
  code: ValueOverrideMutationErrorCode;

  constructor(code: ValueOverrideMutationErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ValueOverrideMutationError";
    this.code = code;
    this.status = status;
  }
}

export const normalizeValueOverrideMutationError = (error: unknown): ValueOverrideMutationError => {
  if (error instanceof ValueOverrideMutationError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 403) {
      return new ValueOverrideMutationError("permission_denied", "You do not have permission to modify this list.", 403);
    }
    if (status === 404) {
      return new ValueOverrideMutationError("not_found", "List no longer exists.", 404);
    }

    const data = error.response?.data as { error?: string; message?: string } | undefined;
    const message =
      data?.error ??
      data?.message ??
      error.response?.statusText ??
      error.message ??
      "List mutation failed.";
    return new ValueOverrideMutationError("unknown", message, status);
  }

  if (error instanceof Error) {
    return new ValueOverrideMutationError("unknown", error.message);
  }
  return new ValueOverrideMutationError("unknown", "List mutation failed.");
};

function parseOrThrow<T>(
  label: string,
  data: unknown,
  schema: z.ZodSchema<T>,
  toastMessage: string
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(`Invalid ${label} response`, { error: parsed.error, data });
    toast.error(toastMessage);
    throw new Error(`Invalid ${label} response.`);
  }
  return parsed.data;
}

export function toListRow(meta: ValueOverrideMeta, section: SectionKey): ListRow {
  return {
    id: meta.listId,
    name: meta.listName,
    owner: meta.owner,
    userId: meta.userId ?? null,
    isShared: meta.isShared,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    expiresAt: meta.expiresAt ?? null,
    rowCount: meta.rowCount ?? 0,
    listType: section,
  };
}

/* ─────────────────────────────────────────────
 * Templates
 * ───────────────────────────────────────────── */

export const getTemplate = async (
  type: ValueOverrideType
): Promise<AxiosResponse<Blob>> => {
  return api.get(`/value_overrides/templates/${type}`, {
    responseType: "blob",
  });
};

/* ─────────────────────────────────────────────
 * Upload
 * ───────────────────────────────────────────── */

export async function uploadListFile(
  type: ValueOverrideType,
  file: File,
  listName: string,
  isShared: boolean
): Promise<UploadResult> {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("list_name", listName);
    form.append("is_shared", isShared ? "1" : "0");

    const res = await api.post<UploadResult>(
      `/value_overrides/${type}/uploads`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    return res.data;
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      const msg =
        (e.response?.data as any)?.error ||
        e.response?.statusText ||
        e.message ||
        "Upload failed";
      throw new Error(msg);
    }
    throw e;
  }
}

export async function patchValueOverrideVisibility(
  type: ValueOverrideType,
  listId: string,
  isShared: boolean
): Promise<{ listId: string; type: ValueOverrideType; isShared: boolean }> {
  try {
    const res = await api.patch(`/value_overrides/${type}/${listId}`, { isShared });
    return parseOrThrow(
      "value override update",
      res.data,
      ValueOverridePatchSchema,
      "Failed to update list."
    );
  } catch (error) {
    throw normalizeValueOverrideMutationError(error);
  }
}

/* ─────────────────────────────────────────────
 * List Index (for cards / tables)
 * ───────────────────────────────────────────── */

export async function fetchValueOverrideIndex(
  includeExpired = false
): Promise<ValueOverrideIndexResponse> {
  const res = await api.get<ValueOverrideIndexResponse>("/value_overrides", {
    params: { include_expired: includeExpired ? 1 : 0 },
  });
  return parseOrThrow("value override lists", res.data, ValueOverrideIndexSchema, "Failed to load lists.");
}

/* ─────────────────────────────────────────────
 * Preview (paged rows)
 * ───────────────────────────────────────────── */

export async function fetchValueOverridePreview(
  type: ValueOverrideType,
  listId: string,
  opts?: {
    limit?: number;
    offset?: number;
    includeExpired?: boolean;
  }
): Promise<ValueOverridePreviewResponse> {
  const res = await api.get<ValueOverridePreviewResponse>(
    `/value_overrides/${type}/${listId}/preview`,
    {
      params: {
        limit: opts?.limit ?? 100,
        offset: opts?.offset ?? 0,
        include_expired: opts?.includeExpired ? 1 : 0,
      },
    }
  );
  return parseOrThrow("value override preview", res.data, ValueOverridePreviewSchema, "Failed to load preview.");
}

/* ─────────────────────────────────────────────
 * (Optional future) Expire / Delete
 * ───────────────────────────────────────────── */

export async function deleteValueOverride(
  type: ValueOverrideType,
  listId: string
): Promise<void> {
  try {
    await api.delete(`/value_overrides/${type}/${listId}`);
  } catch (error) {
    throw normalizeValueOverrideMutationError(error);
  }
}
