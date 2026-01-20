import * as z from "zod";

const Domain = z.enum([
  "physical_therapy","oncology","lab","hospital","surgical","claims","pharmacy","unknown"
]);

const IntentPrimary = z.enum([
  "select","count","trend","compare","distribution","cohort","unknown"
]);

const ProviderEntitySchema = z.object({
  role: z.enum(["provider","therapist","referring_provider","facility","unknown"]),
  specialty: z.string().optional(),
  identifiers: z.array(z.object({
    kind: z.enum(["npi","taxonomy","tin","unknown"]),
    value: z.string().optional(),
  })).optional(),
});

const GeographyEntitySchema = z.object({
  kind: z.enum(["state","region","zip","cbsa","county","unknown"]),
  values: z.array(z.string()).min(1),
  scope: z.enum(["facility","provider","patient","unknown"]).optional(),
});

const TimeEntitySchema = z.object({
  kind: z.enum(["absolute","relative","range","unknown"]),
  start: z.string().optional(),
  end: z.string().optional(),
  relative: z.enum(["last_30_days","last_90_days","ytd","mtd","unknown"]).optional(),
  column_hint: z.string().optional(),
});

const StatusEntitySchema = z.object({
  kind: z.enum(["missing","inactive","expired","no_longer","unknown"]),
  target: z.enum(["provider","facility","record","membership","unknown"]),
  rationale: z.string().optional(),
});

const SuggestedColumnSchema = z.object({
  concept: z.string(),
  rationale: z.string(),
  priority: z.enum(["high","medium","low"]),
});

const SuggestedFilterSchema = z.object({
  concept: z.string(),
  operator_hint: z.enum(["eq","in","like","between","gte","lte","is_null","is_not_null","unknown"]),
  value_hint: z.union([z.string(), z.array(z.string())]).optional(),
  rationale: z.string(),
  priority: z.enum(["high","medium","low"]),
});

export const NerV1Schema = z.object({
  version: z.literal("ner_v1"),
  query: z.string(),
  intent: z.object({
    primary: IntentPrimary,
    confidence: z.number().min(0).max(1),
    explanation: z.string(),
  }),
  domains: z.array(z.object({ domain: Domain, confidence: z.number().min(0).max(1) })),
  entities: z.object({
    provider: z.array(ProviderEntitySchema).optional(),
    geography: z.array(GeographyEntitySchema).optional(),
    time: z.array(TimeEntitySchema).optional(),
    status: z.array(StatusEntitySchema).optional(),
    metrics: z.array(z.object({ concept: z.string(), function_hint: z.string().optional() })).optional(),
    group_by: z.array(z.object({ concept: z.string() })).optional(),
    sort: z.array(z.object({ concept: z.string(), direction: z.enum(["asc","desc"]) })).optional(),
    limit: z.number().int().positive().optional(),
  }),
  hints: z.object({
    must_have_concepts: z.array(z.string()),
    nice_to_have_concepts: z.array(z.string()),
    exclude_concepts: z.array(z.string()),
    candidate_tables: z.array(z.string()).optional(),
  }),
  suggested: z.object({
    columns: z.array(SuggestedColumnSchema),
    filters: z.array(SuggestedFilterSchema),
    groupings: z.array(z.object({ concept: z.string(), rationale: z.string() })),
    aggregations: z.array(z.object({
      concept: z.string(),
      function_hint: z.enum(["count","count_distinct","sum","avg","min","max","unknown"]),
      rationale: z.string(),
    })),
  }),
  safety: z.object({
    contains_phi_risk: z.boolean(),
    warnings: z.array(z.string()),
  }),
});

export type NerV1 = z.infer<typeof NerV1Schema>;

export type UiColumn = {
  name: string;               // column_name
  table_name: string;         // model_table_name for display
  data_type: string | null;
  description: string;

  workspace_table_id: number; // ✅ needed
  full_name: string;          // ✅ needed
};

export type UiBuilderColumn = UiColumn & {
  workspaceTableId: number;
  fullName: string;

  modelTableName: string;
  columnName: string; // same as name, but explicit

  sampleValuesJson: string | null;
  sampleStatsJson: string | null;
  sampleRanAt: string | null;
  sampleError: string | null;
}

export type AggColumnMeta = {
  name: string;
  data_type?: string | null;
  table?: string | null;
};

export type AggFn = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";

export type AggMetric = {
  id: string;
  fn: AggFn;
  column: string | null; // null => COUNT(*)
  label: string;
};

export type AggregationsModel = {
  enabled: boolean;
  metrics: AggMetric[];
  groupBy: string[];
};