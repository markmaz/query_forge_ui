import { z } from "zod";

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

type ListContainer<T> = {
  items?: T[];
  rows?: T[];
  results?: T[];
  data?: T[];
  total?: number;
  count?: number;
  page?: number;
  page_size?: number;
  limit?: number;
};

const positiveOrFallback = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
};

export function parseEntity<T>(data: unknown, schema: z.ZodType<T>, message: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(message);
  }
  return parsed.data;
}

export function parsePaginatedResponse<T>(data: unknown, itemSchema: z.ZodType<T>): PaginatedResult<T> {
  if (Array.isArray(data)) {
    const items = z.array(itemSchema).parse(data);
    return {
      items,
      page: 1,
      page_size: items.length > 0 ? items.length : 25,
      total: items.length,
    };
  }

  const listSchema = z
    .object({
      items: z.array(itemSchema).optional(),
      rows: z.array(itemSchema).optional(),
      results: z.array(itemSchema).optional(),
      data: z.array(itemSchema).optional(),
      total: z.coerce.number().optional(),
      count: z.coerce.number().optional(),
      page: z.coerce.number().optional(),
      page_size: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    })
    .passthrough();

  const parsed = listSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid list response payload.");
  }

  const container = parsed.data as ListContainer<T>;
  const items = container.items ?? container.rows ?? container.results ?? container.data ?? [];
  const page_size = positiveOrFallback(container.page_size ?? container.limit, items.length || 25);
  const total = positiveOrFallback(container.total ?? container.count ?? items.length, items.length);
  const page = positiveOrFallback(container.page, 1);

  return { items, page, page_size, total };
}

