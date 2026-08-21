import { z } from "zod";
import { EntityIdSchema, UtcDateTimeSchema } from "./shared.js";
import { UpcSchema } from "./product.js";

export const GroceryListItemSchema = z.object({
  id: EntityIdSchema,
  listId: EntityIdSchema.optional(),
  name: z.string().trim().min(1),
  quantity: z.number().int().positive().default(1),
  purchased: z.boolean().default(false),
  requestedUpc: UpcSchema.optional(),
  requestedCategory: z.string().trim().min(1).optional(),
  requestedBrand: z.string().trim().min(1).optional()
});

export const GroceryListSchema = z.object({
  id: EntityIdSchema,
  userId: EntityIdSchema.optional(),
  title: z.string().trim().min(1),
  status: z.enum(["active", "completed", "archived"]),
  items: z.array(GroceryListItemSchema),
  includeRebates: z.boolean().default(true),
  verifiedOffersOnly: z.boolean().default(true),
  maxStores: z.number().int().min(1).max(10).default(2),
  createdAt: UtcDateTimeSchema,
  updatedAt: UtcDateTimeSchema
});

export type GroceryListItem = z.infer<typeof GroceryListItemSchema>;
export type GroceryList = z.infer<typeof GroceryListSchema>;
