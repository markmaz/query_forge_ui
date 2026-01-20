import { z } from "zod";

export const CrosswalkTypeSchema = z.enum(["regions", "npiCategories", "serviceLines"]);
export type CrosswalkType = z.infer<typeof CrosswalkTypeSchema>;

export const CrosswalkMetaSchema = z.object({
  listId: z.string(),
  listName: z.string(),
  owner: z.string(),
  userId: z.string().nullable().optional(),
  isShared: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  rowCount: z.number(),
});

export const CrosswalkIndexSchema = z.object({
  regions: z.array(CrosswalkMetaSchema),
  npiCategories: z.array(CrosswalkMetaSchema),
  serviceLines: z.array(CrosswalkMetaSchema),
});

export type CrosswalkMeta = z.infer<typeof CrosswalkMetaSchema>;
export type CrosswalkIndexResponse = z.infer<typeof CrosswalkIndexSchema>;

export const CrosswalkPreviewSchema = z.object({
  listId: z.string(),
  listName: z.string(),
  listType: CrosswalkTypeSchema,
  columns: z.array(z.object({ name: z.string(), type: z.string().optional() })),
  rows: z.array(z.record(z.string(), z.unknown())),
  totalRows: z.number(),
});
export type CrosswalkPreviewResponse = z.infer<typeof CrosswalkPreviewSchema>;
