import api from "./api";
import axios from "axios";
import type { AxiosResponse } from "axios";
import type { UploadResult } from "../../features/crosswalks/ui/components/UploadWizardModal";
import {
  CrosswalkIndexSchema,
  CrosswalkPreviewSchema,
  CrosswalkTypeSchema,
  type CrosswalkType,
  type CrosswalkIndexResponse,
  type CrosswalkPreviewResponse,
  type CrosswalkMeta,
} from "../../features/crosswalks/model/crosswalkSchemas";
import { toast } from "react-toastify";
import { z } from "zod";
import type { ListRow, SectionKey } from "../../features/crosswalks/ui/components/ListSectionCard";

const CrosswalkPatchSchema = z.object({
  listId: z.string(),
  type: CrosswalkTypeSchema,
  isShared: z.boolean(),
});

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

export function toListRow(meta: CrosswalkMeta, section: SectionKey): ListRow {
  return {
    id: meta.listId,
    name: meta.listName,
    owner: meta.owner,
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
  type: CrosswalkType
): Promise<AxiosResponse<Blob>> => {
  return api.get(`/crosswalks/templates/${type}`, {
    responseType: "blob",
  });
};

/* ─────────────────────────────────────────────
 * Upload
 * ───────────────────────────────────────────── */

export async function uploadListFile(
  type: CrosswalkType,
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
      `/crosswalks/${type}/uploads`,
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

export async function patchCrosswalkVisibility(
  type: CrosswalkType,
  listId: string,
  isShared: boolean
): Promise<{ listId: string; type: CrosswalkType; isShared: boolean }> {
  const res = await api.patch(`/crosswalks/${type}/${listId}`, { isShared });
  return parseOrThrow(
    "crosswalk update",
    res.data,
    CrosswalkPatchSchema,
    "Failed to update crosswalk."
  );
}

/* ─────────────────────────────────────────────
 * List Index (for cards / tables)
 * ───────────────────────────────────────────── */

export async function fetchCrosswalkIndex(
  includeExpired = false
): Promise<CrosswalkIndexResponse> {
  const res = await api.get<CrosswalkIndexResponse>("/crosswalks", {
    params: { include_expired: includeExpired ? 1 : 0 },
  });
  return parseOrThrow("crosswalk lists", res.data, CrosswalkIndexSchema, "Failed to load crosswalk lists.");
}

/* ─────────────────────────────────────────────
 * Preview (paged rows)
 * ───────────────────────────────────────────── */

export async function fetchCrosswalkPreview(
  type: CrosswalkType,
  listId: string,
  opts?: {
    limit?: number;
    offset?: number;
    includeExpired?: boolean;
  }
): Promise<CrosswalkPreviewResponse> {
  const res = await api.get<CrosswalkPreviewResponse>(
    `/crosswalks/${type}/${listId}/preview`,
    {
      params: {
        limit: opts?.limit ?? 100,
        offset: opts?.offset ?? 0,
        include_expired: opts?.includeExpired ? 1 : 0,
      },
    }
  );
  return parseOrThrow("crosswalk preview", res.data, CrosswalkPreviewSchema, "Failed to load crosswalk preview.");
}

/* ─────────────────────────────────────────────
 * (Optional future) Expire / Delete
 * ───────────────────────────────────────────── */

export async function deleteCrosswalk(
  type: CrosswalkType,
  listId: string
): Promise<void> {
  await api.delete(`/crosswalks/${type}/${listId}`);
}
