import { z } from "zod";

export const ValueOverrideTypeSchema = z.enum(["regions", "npiCategories", "serviceLines"]);
export type ValueOverrideType = z.infer<typeof ValueOverrideTypeSchema>;

export const ValueOverrideMetaSchema = z
  .object({
    listId: z.string(),
    listName: z.string(),
    owner: z.string(),
    userId: z.string().nullable().optional(),
    user_id: z.string().nullable().optional(),
    isShared: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    expiresAt: z.string().nullable().optional(),
    rowCount: z.number(),
  })
  .transform((row) => ({
    ...row,
    userId: row.userId ?? row.user_id ?? null,
  }));

export const ValueOverrideIndexSchema = z.object({
  regions: z.array(ValueOverrideMetaSchema),
  npiCategories: z.array(ValueOverrideMetaSchema),
  serviceLines: z.array(ValueOverrideMetaSchema),
});

export type ValueOverrideMeta = z.infer<typeof ValueOverrideMetaSchema>;
export type ValueOverrideIndexResponse = z.infer<typeof ValueOverrideIndexSchema>;

export const ValueOverridePreviewSchema = z.object({
  listId: z.string(),
  listName: z.string(),
  listType: ValueOverrideTypeSchema,
  columns: z.array(z.object({ name: z.string(), type: z.string().optional() })),
  rows: z.array(z.record(z.string(), z.unknown())),
  totalRows: z.number(),
});
export type ValueOverridePreviewResponse = z.infer<typeof ValueOverridePreviewSchema>;
