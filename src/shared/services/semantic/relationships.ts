import { z } from "zod";

import api from "../api";
import { parsePaginatedResponse, type PaginatedResult } from "./common";
import { toServiceError } from "./errors";

export type SemanticRelationship = {
  id: number;
  parent_concept_id: number;
  child_concept_id: number;
  relationship_type: string;
  parent_concept_name: string | null;
  child_concept_name: string | null;
  parent_display_label: string | null;
  child_display_label: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SemanticRelationshipConcept = {
  concept_id: number;
  concept_key: string | null;
  name: string | null;
  display_label: string;
};

export type SemanticRelationshipListParams = {
  parent_id?: number;
  child_id?: number;
  parent_concept_id?: number;
  child_concept_id?: number;
  relationship_type?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

export type SemanticRelationshipConceptListParams = {
  q?: string;
  page?: number;
  page_size?: number;
};

export type SemanticRelationshipMutationPayload = {
  parent_concept_id: number;
  child_concept_id: number;
  relationship_type: string;
};

export type SemanticRelationshipPatchPayload = Partial<SemanticRelationshipMutationPayload>;

const BASE_PATH = "/semantic/relationships";

const toNumericId = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : null;
};

const relationshipSchema = z
  .object({
    id: z.unknown().optional(),
    relationship_id: z.unknown().optional(),
    parent_concept_id: z.unknown().optional(),
    parent_id: z.unknown().optional(),
    child_concept_id: z.unknown().optional(),
    child_id: z.unknown().optional(),
    relationship_type: z.string().optional().default(""),
    parent_concept_name: z.string().nullable().optional(),
    child_concept_name: z.string().nullable().optional(),
    parent_display_label: z.string().nullable().optional(),
    child_display_label: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value, ctx) => {
    const id = toNumericId(value.id) ?? toNumericId(value.relationship_id);
    const parentId = toNumericId(value.parent_concept_id) ?? toNumericId(value.parent_id);
    const childId = toNumericId(value.child_concept_id) ?? toNumericId(value.child_id);

    if (id == null || parentId == null || childId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid semantic relationship payload.",
      });
      return z.NEVER;
    }

    return {
      id,
      parent_concept_id: parentId,
      child_concept_id: childId,
      relationship_type: value.relationship_type.trim(),
      parent_concept_name: value.parent_concept_name ?? null,
      child_concept_name: value.child_concept_name ?? null,
      parent_display_label: value.parent_display_label ?? null,
      child_display_label: value.child_display_label ?? null,
      created_at: value.created_at ?? null,
      updated_at: value.updated_at ?? null,
    } satisfies SemanticRelationship;
  });

const relationshipConceptSchema = z
  .object({
    concept_id: z.unknown().optional(),
    id: z.unknown().optional(),
    concept_key: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    display_label: z.string().nullable().optional(),
    parent_display_label: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value, ctx) => {
    const conceptId = toNumericId(value.concept_id) ?? toNumericId(value.id);
    if (conceptId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid relationship concept payload.",
      });
      return z.NEVER;
    }

    const displayLabel =
      value.display_label?.trim() ||
      value.parent_display_label?.trim() ||
      value.name?.trim() ||
      value.concept_key?.trim() ||
      `Concept #${conceptId}`;

    return {
      concept_id: conceptId,
      concept_key: value.concept_key ?? null,
      name: value.name ?? null,
      display_label: displayLabel,
    } satisfies SemanticRelationshipConcept;
  });

const relationshipMutationSchema = z
  .object({
    parent_concept_id: z.coerce.number().int().positive(),
    child_concept_id: z.coerce.number().int().positive(),
    relationship_type: z.string().trim().min(1),
  })
  .refine((value) => value.parent_concept_id !== value.child_concept_id, {
    message: "Parent and child concepts must be different.",
    path: ["child_concept_id"],
  });

const relationshipPatchSchema = z
  .object({
    parent_concept_id: z.coerce.number().int().positive().optional(),
    child_concept_id: z.coerce.number().int().positive().optional(),
    relationship_type: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.parent_concept_id == null || value.child_concept_id == null || value.parent_concept_id !== value.child_concept_id,
    {
      message: "Parent and child concepts must be different.",
      path: ["child_concept_id"],
    }
  );

const relationshipResponseCandidates = (payload: unknown): unknown[] => {
  const body = (payload as Record<string, unknown> | null) ?? null;
  return [payload, body?.result, body?.data, body?.row, body?.item].filter(Boolean);
};

const parseRelationshipFromPayload = (
  payload: unknown,
  fallback: SemanticRelationship
): SemanticRelationship => {
  for (const candidate of relationshipResponseCandidates(payload)) {
    const parsed = relationshipSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return fallback;
};

export async function listSemanticRelationships(
  params: SemanticRelationshipListParams
): Promise<PaginatedResult<SemanticRelationship>> {
  try {
    const response = await api.get(BASE_PATH, {
      params: {
        parent_id: params.parent_id,
        child_id: params.child_id,
        parent_concept_id: params.parent_concept_id,
        child_concept_id: params.child_concept_id,
        relationship_type: params.relationship_type,
        q: params.q,
        page: params.page,
        page_size: params.page_size,
      },
    });
    return parsePaginatedResponse(response.data, relationshipSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic relationships.");
  }
}

export async function createSemanticRelationship(
  payload: SemanticRelationshipMutationPayload
): Promise<SemanticRelationship> {
  try {
    const request = relationshipMutationSchema.parse(payload);
    const response = await api.post(BASE_PATH, request);
    return parseRelationshipFromPayload(response.data, {
      id: 0,
      parent_concept_id: request.parent_concept_id,
      child_concept_id: request.child_concept_id,
      relationship_type: request.relationship_type,
      parent_concept_name: null,
      child_concept_name: null,
      parent_display_label: null,
      child_display_label: null,
      created_at: null,
      updated_at: null,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to create semantic relationship.");
  }
}

export async function getSemanticRelationship(id: number): Promise<SemanticRelationship> {
  try {
    const response = await api.get(`${BASE_PATH}/${id}`);
    return parseRelationshipFromPayload(response.data, {
      id,
      parent_concept_id: 0,
      child_concept_id: 0,
      relationship_type: "",
      parent_concept_name: null,
      child_concept_name: null,
      parent_display_label: null,
      child_display_label: null,
      created_at: null,
      updated_at: null,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic relationship.");
  }
}

export async function patchSemanticRelationship(
  id: number,
  payload: SemanticRelationshipPatchPayload
): Promise<SemanticRelationship> {
  try {
    const request = relationshipPatchSchema.parse(payload);
    const response = await api.patch(`${BASE_PATH}/${id}`, request);
    return parseRelationshipFromPayload(response.data, {
      id,
      parent_concept_id: request.parent_concept_id ?? 0,
      child_concept_id: request.child_concept_id ?? 0,
      relationship_type: request.relationship_type ?? "",
      parent_concept_name: null,
      child_concept_name: null,
      parent_display_label: null,
      child_display_label: null,
      created_at: null,
      updated_at: null,
    });
  } catch (error) {
    throw toServiceError(error, "Unable to update semantic relationship.");
  }
}

export async function deleteSemanticRelationship(id: number): Promise<void> {
  try {
    await api.delete(`${BASE_PATH}/${id}`);
  } catch (error) {
    throw toServiceError(error, "Unable to delete semantic relationship.");
  }
}

export async function listSemanticRelationshipConcepts(
  params: SemanticRelationshipConceptListParams
): Promise<PaginatedResult<SemanticRelationshipConcept>> {
  try {
    const response = await api.get(`${BASE_PATH}/concepts`, {
      params: {
        q: params.q,
        page: params.page,
        page_size: params.page_size,
      },
    });
    return parsePaginatedResponse(response.data, relationshipConceptSchema);
  } catch (error) {
    throw toServiceError(error, "Unable to load semantic relationship concepts.");
  }
}
