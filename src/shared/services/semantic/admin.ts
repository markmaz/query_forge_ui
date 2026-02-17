import api from "../api";
import { toServiceError } from "./errors";

export type RebuildSemanticConceptIndexResponse = {
  message?: string;
  summary?: string;
  vertical_norm?: string;
  [key: string]: unknown;
};

export async function rebuildSemanticConceptVectors(
  vertical_norm: string
): Promise<RebuildSemanticConceptIndexResponse> {
  try {
    const response = await api.post("/semantic/concepts/rebuild-index", { vertical_norm });
    if (!response.data || typeof response.data !== "object") {
      return { vertical_norm };
    }
    return response.data as RebuildSemanticConceptIndexResponse;
  } catch (error) {
    throw toServiceError(error, "Unable to rebuild concept vector index.");
  }
}
