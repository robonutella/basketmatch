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
  createdAt: UtcDateTimeSchema,
  updatedAt: UtcDateTimeSchema
});

export type GroceryListItem = z.infer<typeof GroceryListItemSchema>;
export type GroceryList = z.infer<typeof GroceryListSchema>;
