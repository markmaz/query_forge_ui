import { z } from "zod";

/**
 * Query Builder State (qb.v1) — Zod schema
 * - Designed to rehydrate UI + represent query meaning
 * - UI is optional; everything else is the portable “meaning”
 */

export const SectionKeySchema = z.enum([
  "prompt",
  "suggested",
  "domain",
  "columns",
  "filters",
  "aggs",
  "preview",
  // ✅ NEW (optional UI section later if you want)
  "sorting",
]);
export type SectionKey = z.infer<typeof SectionKeySchema>;

export const SortDirSchema = z.enum(["asc", "desc"]);

export const QueryPathStatusSchema = z.enum(["todo", "active", "done"]); // (if you ever store this)

export const FieldRefSchema = z
  .object({
    name: z.string().min(1),
    table: z.string().min(1).optional(), // keep optional if you sometimes only know column name
  })
  .strict();

export const MetaSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export const PromptSchema = z
  .object({
    text: z.string().default(""),
    mode: z.enum(["optional", "used"]).optional(),
    examplesUsed: z.boolean().optional(),
  })
  .strict();

export const DomainSchema = z
  .object({
    domainId: z.string().min(1),
    crosswalks: z
      .object({
        A: z.string().optional().default(""),
        B: z.string().optional().default(""),
        C: z.string().optional().default(""),
      })
      .strict()
      .optional()
      .default({ A: "", B: "", C: "" }),
    crosswalkEnabled: z.boolean().optional(),
  })
  .strict();

// ✅ NEW: inline sort metadata on selected columns (optional)
export const ColumnSortSchema = z
  .object({
    dir: SortDirSchema,
    // optional, because array order can define priority
    priority: z.number().int().positive().optional(),
  })
  .strict();

export const SelectedColumnSchema = z
  .object({
    name: z.string().min(1),
    table: z.string().min(1).optional(),

    // ✅ NEW
    sort: ColumnSortSchema.optional(),
  })
  .strict();

export const ColumnsSchema = z
  .object({
    selected: z.array(SelectedColumnSchema).default([]),
  })
  .strict();

export const FilterOpSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "between",
  "contains",
  "starts_with",
  "ends_with",
  "is_null",
  "is_not_null",
]);

export const ValueTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "array",
  "null",
]);

export const FilterItemSchema = z
  .object({
    id: z.string().min(1),
    field: FieldRefSchema,
    op: FilterOpSchema,
    value: z.any().optional(), // validated by valueType/op at runtime logic layer
    valueType: ValueTypeSchema.optional(),
  })
  .strict();

export const FilterLogicNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z
      .object({
        type: z.enum(["and", "or"]),
        children: z.array(z.union([z.string().min(1), FilterLogicNodeSchema])),
      })
      .strict(),
    z.string().min(1), // allow a single leaf id as shorthand
  ])
);

export const FiltersSchema = z
  .object({
    items: z.array(FilterItemSchema).default([]),
    logic: FilterLogicNodeSchema.optional(), // if omitted, interpret as AND all items
  })
  .strict();

export const AggFnSchema = z.enum([
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
]);

export const MetricSchema = z
  .object({
    id: z.string().min(1),
    fn: AggFnSchema,
    field: FieldRefSchema.optional(), // count(*) can omit field
    as: z.string().min(1).optional(),
  })
  .strict();

export const AggregationsSchema = z
  .object({
    groupBy: z.array(FieldRefSchema).default([]),
    metrics: z.array(MetricSchema).default([]),
  })
  .strict();

export const SortItemSchema = z
  .object({
    field: FieldRefSchema,
    dir: SortDirSchema,
    // optional, because array order can define priority
    priority: z.number().int().positive().optional(),
  })
  .strict();

// ✅ NEW: dedicated Sorting section (recommended “source of truth”)
export const SortingSchema = z
  .object({
    orderBy: z.array(SortItemSchema).default([]),
  })
  .strict();

export const PreviewSchema = z
  .object({
    rowLimit: z.number().int().positive().optional(),

    // ⚠️ legacy/compat: if you already store sort here, keep it
    // Prefer state.sorting.orderBy going forward.
    sort: z.array(SortItemSchema).optional(),
  })
  .strict();

export const SavedQueriesPanelUiSchema = z
  .object({
    open: z.boolean().default(false),
    search: z.string().default(""),
    openGroups: z
      .object({
        shared: z.boolean().default(true),
        mine: z.boolean().default(true),
        recent: z.boolean().default(true),
      })
      .strict()
      .default({ shared: true, mine: true, recent: true }),
  })
  .strict();

export const SectionUiStateSchema = z
  .object({
    visible: z.boolean().default(true),
    collapsed: z.boolean().default(false),
  })
  .strict();

export const UiSchema = z
  .object({
    activeSection: SectionKeySchema.optional(),
    sections: z.record(SectionKeySchema, SectionUiStateSchema).optional(),
    savedQueriesPanel: SavedQueriesPanelUiSchema.optional(),
  })
  .strict();

export const QueryBuilderStateV1Schema = z
  .object({
    version: z.literal("qb.v1"),

    meta: MetaSchema.optional(),

    prompt: PromptSchema.optional().default({ text: "" }),
    domain: DomainSchema.optional(), // optional if prompt-only flows start with none
    columns: ColumnsSchema.optional().default({ selected: [] }),
    filters: FiltersSchema.optional().default({ items: [] }),
    aggregations: AggregationsSchema
      .optional()
      .default({ groupBy: [], metrics: [] }),

    // ✅ NEW: preferred place for sorting
    sorting: SortingSchema.optional().default({ orderBy: [] }),

    preview: PreviewSchema.optional(),

    ui: UiSchema.optional(),
  })
  .strict();

export type QueryBuilderStateV1 = z.infer<typeof QueryBuilderStateV1Schema>;