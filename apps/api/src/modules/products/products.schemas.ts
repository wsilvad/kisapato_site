import { z } from "zod";

export const listProductsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().optional(),
  search: z.string().trim().min(1).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuery>;
