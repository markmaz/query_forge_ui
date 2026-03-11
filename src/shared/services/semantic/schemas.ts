import { z } from "zod";

const boolishSchema = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    return value.trim().toLowerCase() === "true" || value.trim() === "1";
  });

function normalizeId(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : undefined;
}

const semanticConceptRawSchema = z
  .object({
    concept_id: z.unknown().optional(),
    id: z.unknown().optional(),
    vertical_norm: z.string().default(""),
    concept_key: z.string().default(""),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    semantic_type: z.string().default(""),
    sub_type: z.string().nullable().optional(),
    entity: z.string().nullable().optional(),
    granularity_rank: z.coerce.number().nullable().optional(),
    filter_allowed: boolishSchema.default(false),
    group_by_allowed: boolishSchema.default(false),
    aggregation_allowed: boolishSchema.default(false),
    is_identifier: boolishSchema.default(false),
    is_metric: boolishSchema.default(false),
    display_priority: z.coerce.number().nullable().optional(),
    sensitive: boolishSchema.default(false),
    status: z.string().default("active"),
  })
  .passthrough()
  .transform((value, ctx) => {
    const conceptId = normalizeId(value.concept_id) ?? normalizeId(value.id);
    if (conceptId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing concept id in response payload.",
      });
      return z.NEVER;
    }

    return {
      concept_id: conceptId,
      vertical_norm: value.vertical_norm,
      concept_key: value.concept_key,
      name: value.name ?? null,
      description: value.description ?? null,
      semantic_type: value.semantic_type,
      sub_type: value.sub_type ?? null,
      entity: value.entity ?? null,
      granularity_rank: value.granularity_rank ?? null,
      filter_allowed: value.filter_allowed,
      group_by_allowed: value.group_by_allowed,
      aggregation_allowed: value.aggregation_allowed,
      is_identifier: value.is_identifier,
      is_metric: value.is_metric,
      display_priority: value.display_priority ?? null,
      sensitive: value.sensitive,
      status: value.status,
    };
  });

const conceptAliasRawSchema = z
  .object({
    alias_id: z.unknown().optional(),
    id: z.unknown().optional(),
    vertical_norm: z.string().default(""),
    alias_key: z.string().default(""),
    concept_key: z.string().default(""),
    match_kind: z.string().default("contains"),
    weight: z.coerce.number().default(1),
  })
  .passthrough()
  .transform((value, ctx) => {
    const aliasId = normalizeId(value.alias_id) ?? normalizeId(value.id);
    if (aliasId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing alias id in response payload.",
      });
      return z.NEVER;
    }

    return {
      alias_id: aliasId,
      vertical_norm: value.vertical_norm,
      alias_key: value.alias_key,
      concept_key: value.concept_key,
      match_kind: value.match_kind,
      weight: value.weight,
    };
  });

const valueAliasRawSchema = z
  .object({
    value_alias_id: z.unknown().optional(),
    id: z.unknown().optional(),
    vertical_norm: z.string().default(""),
    semantic_concept_id: z.coerce.number(),
    concept_key: z.string().nullable().optional(),
    concept_name: z.string().nullable().optional(),
    canonical_value: z.string().default(""),
    alias_value: z.string().default(""),
    match_kind: z.string().default("contains"),
    weight: z.coerce.number().default(1),
  })
  .passthrough()
  .transform((value, ctx) => {
    const valueAliasId = normalizeId(value.value_alias_id) ?? normalizeId(value.id);
    if (valueAliasId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing value alias id in response payload.",
      });
      return z.NEVER;
    }

    return {
      value_alias_id: valueAliasId,
      vertical_norm: value.vertical_norm,
      semantic_concept_id: value.semantic_concept_id,
      concept_key: value.concept_key ?? null,
      concept_name: value.concept_name ?? null,
      canonical_value: value.canonical_value,
      alias_value: value.alias_value,
      match_kind: value.match_kind,
      weight: value.weight,
    };
  });

const conceptColumnMapRawSchema = z
  .object({
    map_id: z.unknown().optional(),
    id: z.unknown().optional(),
    vertical_norm: z.string().default(""),
    semantic_concept_id: z.coerce.number(),
    concept_key: z.string().nullable().optional(),
    concept_name: z.string().nullable().optional(),
    model_column_id: z.coerce.number().nullable().optional(),
    workspace_column_id: z.coerce.number().nullable().optional(),
    column_name: z.string().nullable().optional(),
    model_table_name: z.string().nullable().optional(),
    relationship_kind: z.string().default("primary"),
    weight: z.coerce.number().default(1),
    created_at: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value, ctx) => {
    const mapId = normalizeId(value.map_id) ?? normalizeId(value.id);
    if (mapId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing concept-column map id in response payload.",
      });
      return z.NEVER;
    }

    return {
      map_id: mapId,
      vertical_norm: value.vertical_norm,
      semantic_concept_id: value.semantic_concept_id,
      concept_key: value.concept_key ?? null,
      concept_name: value.concept_name ?? null,
      model_column_id: value.model_column_id ?? null,
      workspace_column_id: value.workspace_column_id ?? null,
      column_name: value.column_name ?? null,
      model_table_name: value.model_table_name ?? null,
      relationship_kind: value.relationship_kind,
      weight: value.weight,
      created_at: value.created_at ?? null,
    };
  });

const semanticMappingRawSchema = z
  .object({
    id: z.unknown().optional(),
    semantic_registry_id: z.coerce.number(),
    workspace_id: z.string().nullable().optional(),
    workspace_norm: z.string().nullable().optional(),
    model_column_id: z.coerce.number().nullable().optional(),
    workspace_column_id: z.coerce.number().nullable().optional(),
    table_name: z.string().nullable().optional(),
    column_name: z.string().nullable().optional(),
    priority_rank: z.coerce.number().nullable().optional(),
    confidence_score: z.coerce.number().nullable().optional(),
    created_at: z.string().nullable().optional(),
    concept_key: z.string().nullable().optional(),
    vertical: z.string().nullable().optional(),
    vertical_norm: z.string().nullable().optional(),
    semantic_type: z.string().nullable().optional(),
    entity: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value, ctx) => {
    const mappingId = normalizeId(value.id);
    if (mappingId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing semantic mapping id in response payload.",
      });
      return z.NEVER;
    }

    return {
      id: mappingId,
      semantic_registry_id: value.semantic_registry_id,
      workspace_id: value.workspace_id ?? null,
      workspace_norm: value.workspace_norm ?? null,
      model_column_id: value.model_column_id ?? null,
      workspace_column_id: value.workspace_column_id ?? null,
      table_name: value.table_name ?? null,
      column_name: value.column_name ?? null,
      priority_rank: value.priority_rank ?? null,
      confidence_score: value.confidence_score ?? null,
      created_at: value.created_at ?? null,
      concept_key: value.concept_key ?? null,
      vertical: value.vertical ?? null,
      vertical_norm: value.vertical_norm ?? null,
      semantic_type: value.semantic_type ?? null,
      entity: value.entity ?? null,
    };
  });

const sqlColumnKeySchema = z.object({
  modelColumnId: z.number().nullable().optional(),
  columnName: z.string(),
  workspaceTableId: z.number().nullable().optional(),
  exprId: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
});

export const conceptKeysResponseSchema = z.object({
  concept_keys: z.array(z.string()),
});

export const editOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setDomain"), domainId: z.number() }),
  z.object({ op: z.literal("addSelect"), col: sqlColumnKeySchema, alias: z.string().nullable().optional() }),
  z.object({
    op: z.literal("addFilter"),
    col: sqlColumnKeySchema,
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "starts_with",
      "in",
      "not_in",
      "gt",
      "gte",
      "lt",
      "lte",
      "between",
      "is_null",
      "is_not_null",
    ]),
    value: z.unknown(),
  }),
  z.object({ op: z.literal("addGroupBy"), col: sqlColumnKeySchema }),
  z.object({
    op: z.literal("addAggregate"),
    func: z.enum(["count_distinct", "count", "sum", "avg"]),
    col: sqlColumnKeySchema.nullable().optional(),
    alias: z.string(),
  }),
  z.object({ op: z.literal("addSort"), col: sqlColumnKeySchema, dir: z.enum(["asc", "desc"]) }),
]);

export const plannerRequestSchema = z.object({
  workspace_id: z.string().min(1, "Workspace is required."),
  vertical_norm: z.string().optional(),
  prompt: z.string().min(1, "Prompt is required."),
  domain_id: z.number().optional(),
  max_concepts: z.number().int().positive().optional(),
  max_columns: z.number().int().positive().optional(),
  debug: z.boolean().optional(),
});

export const spacyEntitySchema = z.object({
  start: z.number(),
  end: z.number(),
  label: z.string(),
  text: z.string(),
});

export const spacySlotsSchema = z.object({
  metric: z.array(z.string()),
  dimensions: z.array(z.string()),
  subgroups: z.array(z.string()),
  time_ranges: z.array(z.string()),
  org_schools: z.array(z.string()),
  org_districts: z.array(z.string()),
});

export const spacyExtractionSchema = z.object({
  normalized_text: z.string(),
  ents: z.array(spacyEntitySchema),
  by_label: z.record(z.string(), z.array(z.string())),
  slots: spacySlotsSchema,
  warnings: z.array(z.string()),
});

export const plannerExtractRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required."),
});

export const plannerResponseSchema = z.object({
  prompt: z.string(),
  deterministic: z.object({
    matched: z.array(
      z.object({
        token: z.string(),
        concept_key: z.string(),
        confidence: z.number(),
        reason: z.string(),
      })
    ),
    unmatched_tokens: z.array(z.string()),
  }),
  concept_vector: z.object({
    query_text: z.string(),
    hits: z.array(
      z.object({
        concept_key: z.string(),
        concept_id: z.number().nullable().optional(),
        score: z.number(),
        source: z.string(),
        alias_key: z.string().nullable().optional(),
      })
    ),
  }),
  concept_mapping: z.object({
    concepts: z.array(z.string()),
    mapped_columns: z.array(
      z.object({
        model_column_id: z.number(),
        table_name: z.string(),
        column_name: z.string(),
        concept_key: z.string(),
        weight: z.number(),
      })
    ),
  }),
  column_vector: z.object({
    filtered_to_candidate_count: z.number(),
    hits: z.array(
      z.object({
        model_column_id: z.number(),
        score: z.number(),
        table_name: z.string(),
        column_name: z.string(),
        concept_key: z.string(),
      })
    ),
  }),
  llm_plan: z
    .object({
      model: z.string(),
      sql_json: z.record(z.string(), z.unknown()),
      selected_columns: z.array(
        z.object({
          concept_key: z.string(),
          model_column_id: z.number(),
        })
      ),
      filters: z.array(
        z.object({
          concept_key: z.string(),
          op: z.string(),
          value: z.unknown(),
        })
      ),
      join_plan: z.record(z.string(), z.unknown()),
      confidence: z.number(),
      notes: z.array(z.string()),
    })
    .optional(),
  debug: z.object({
    timings_ms: z.object({
      deterministic: z.number(),
      concept_vector: z.number(),
      concept_mapping: z.number(),
      column_vector: z.number(),
      llm: z.number(),
    }),
    warnings: z.array(z.string()),
  }),
  edits: z.array(editOperationSchema).optional(),
  explanation: z.string().optional(),
  confidence: z.number().optional(),
  spacy: spacyExtractionSchema.optional(),
});

export const plannerSuggestResponseSchema = plannerResponseSchema.extend({
  edits: z.array(editOperationSchema),
  explanation: z.string(),
  confidence: z.number(),
});

export const conceptMutationSchema = z.object({
  vertical_norm: z.string().min(1, "Vertical is required."),
  concept_key: z.string().min(1, "Concept key is required."),
  name: z.string().min(1, "Name is required."),
  description: z.string().nullable().optional(),
  semantic_type: z.string().min(1, "Semantic type is required."),
  sub_type: z.string().nullable().optional(),
  entity: z.string().nullable().optional(),
  granularity_rank: z.number().int().nullable().optional(),
  filter_allowed: z.boolean().default(false),
  group_by_allowed: z.boolean().default(false),
  aggregation_allowed: z.boolean().default(false),
  is_identifier: z.boolean().default(false),
  is_metric: z.boolean().default(false),
  display_priority: z.number().int().nullable().optional(),
  sensitive: z.boolean().default(false),
  status: z.string().min(1, "Status is required."),
});

export const conceptAliasMutationSchema = z.object({
  vertical_norm: z.string().min(1, "Vertical is required."),
  alias_key: z.string().min(1, "Alias key is required."),
  concept_key: z.string().min(1, "Concept key is required."),
  match_kind: z.string().min(1, "Match kind is required."),
  weight: z.number().min(0, "Weight must be >= 0").max(1, "Weight must be <= 1"),
});

export const valueAliasMutationSchema = z.object({
  vertical_norm: z.string().min(1, "Vertical is required."),
  semantic_concept_id: z.number().int().positive("Semantic concept id is required."),
  canonical_value: z.string().min(1, "Canonical value is required."),
  alias_value: z.string().min(1, "Alias value is required."),
  match_kind: z.string().min(1, "Match kind is required."),
  weight: z.number().min(0, "Weight must be >= 0").max(1, "Weight must be <= 1"),
});

export const conceptColumnMapMutationSchema = z.object({
  vertical_norm: z.string().min(1, "Vertical is required."),
  semantic_concept_id: z.number().int().positive("Semantic concept id is required."),
  workspace_column_id: z.number().int().positive("Workspace column id is required."),
  model_column_id: z.number().int().positive().optional(),
  relationship_kind: z.enum(["primary", "alternate", "derived", "rollup", "component"]),
  weight: z.number().min(0, "Weight must be >= 0").max(1, "Weight must be <= 1"),
});

export const semanticMappingMutationSchema = z.object({
  semantic_registry_id: z.number().int().positive("Semantic registry id is required."),
  workspace_id: z.string().min(1).optional(),
  workspace_column_id: z.number().int().positive("Workspace column id is required."),
  model_column_id: z.number().int().positive().optional(),
  table_name: z.string().min(1).optional(),
  column_name: z.string().min(1).optional(),
  priority_rank: z.number().int().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
});

export type SemanticConcept = z.infer<typeof semanticConceptRawSchema>;
export type ConceptAlias = z.infer<typeof conceptAliasRawSchema>;
export type ValueAlias = z.infer<typeof valueAliasRawSchema>;
export type ConceptColumnMap = z.infer<typeof conceptColumnMapRawSchema>;
export type SemanticMapping = z.infer<typeof semanticMappingRawSchema>;
export type ConceptKeysResponse = z.infer<typeof conceptKeysResponseSchema>;
export type PlannerRequest = z.infer<typeof plannerRequestSchema>;
export type PlannerResponse = z.infer<typeof plannerResponseSchema>;
export type PlannerSuggestResponse = z.infer<typeof plannerSuggestResponseSchema>;
export type PlannerExtractRequest = z.infer<typeof plannerExtractRequestSchema>;
export type SpacyExtraction = z.infer<typeof spacyExtractionSchema>;
export type EditOperation = z.infer<typeof editOperationSchema>;
export type ConceptMutationPayload = z.infer<typeof conceptMutationSchema>;
export type ConceptAliasMutationPayload = z.infer<typeof conceptAliasMutationSchema>;
export type ValueAliasMutationPayload = z.infer<typeof valueAliasMutationSchema>;
export type ConceptColumnMapMutationPayload = z.infer<typeof conceptColumnMapMutationSchema>;
export type SemanticMappingMutationPayload = z.infer<typeof semanticMappingMutationSchema>;

export const semanticConceptSchema = semanticConceptRawSchema;
export const conceptAliasSchema = conceptAliasRawSchema;
export const valueAliasSchema = valueAliasRawSchema;
export const conceptColumnMapSchema = conceptColumnMapRawSchema;
export const semanticMappingSchema = semanticMappingRawSchema;
